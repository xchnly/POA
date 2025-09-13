"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, query, where, orderBy, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { Timestamp } from "firebase/firestore";
import Swal from "sweetalert2";

// Interfaces (Ensure these match your Firestore data structure)
interface ApprovalStep {
    role: string;
    dept?: string;
    deptId?: string;
    status: string;
    approvedAt?: Timestamp | string | null;
    approvedBy?: string;
    approvedByName?: string;
    comments?: string;
}

interface Request {
    id: string;
    type: string;
    dept?: string;
    deptId?: string;
    status: string;
    requesterName?: string;
    createdAt?: Timestamp | string | null;
    approvalFlow: ApprovalStep[];
}

interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: string;
    deptId: string;
    nama: string;
    nik: string;
    jabatan: string;
}

export default function AllFormsPage() {
    const [authUser] = useAuthState(auth);
    const [user, setUser] = useState<UserData | null>(null);
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState<Record<string, any>>({});
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Helper function to safely convert Firestore Timestamp or string to Date object
    const safeToDate = (value: Timestamp | string | null | undefined): Date | null => {
        if (value instanceof Timestamp) {
            return value.toDate();
        }
        if (typeof value === 'string') {
            try {
                return new Date(value);
            } catch (e) {
                return null;
            }
        }
        return null;
    };

    // Fetch user data from Firestore
    useEffect(() => {
        const fetchUserData = async () => {
            if (!authUser) {
                setUser(null);
                return;
            }
            try {
                const userDoc = await getDoc(doc(db, "users", authUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUser({
                        uid: authUser.uid,
                        email: authUser.email,
                        displayName: authUser.displayName,
                        role: userData.role || "staff",
                        deptId: userData.dept || "",
                        nama: userData.nama || "",
                        nik: userData.nik || "",
                        jabatan: userData.jabatan || ""
                    });
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                setError("Failed to load user data");
            }
        };
        fetchUserData();
    }, [authUser]);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch departments data
                const deptSnapshot = await getDocs(collection(db, "departments"));
                const deptData: Record<string, any> = {};
                deptSnapshot.forEach((doc) => {
                    deptData[doc.id] = doc.data();
                });
                setDepartments(deptData);

                let formsQuery;
                // Check user role to determine the query
                if (user.role === "staff") {
                    // Staff can only see their own requests
                    formsQuery = query(
                        collection(db, "forms"),
                        where("requesterUid", "==", user.uid),
                        orderBy("createdAt", "desc")
                    );
                } else {
                    // Other roles can see all requests
                    formsQuery = query(
                        collection(db, "forms"),
                        orderBy("createdAt", "desc")
                    );
                }
                
                const snapshot = await getDocs(formsQuery);
                const list: Request[] = [];

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const request: Request = {
                        id: docSnap.id,
                        type: data.type || "unknown",
                        dept: data.dept || "",
                        deptId: data.deptId,
                        status: data.status || "draft",
                        requesterName: data.requesterName,
                        createdAt: data.createdAt,
                        approvalFlow: data.approvalFlow || [],
                    };
                    list.push(request);
                });

                setRequests(list);
            } catch (err: any) {
                console.error("Error fetching data:", err);
                if (err.code === "failed-precondition") {
                    setError("Database index required. Please open your browser's console (F12) to see the link to create it automatically.");
                } else {
                    setError("Failed to load data. Please try again.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleSidebarToggle = () => {
      setIsSidebarOpen(!isSidebarOpen);
    };

    // FUNGSI BARU UNTUK MENGIRIM BROADCAST EMAIL
    const handleSendEmailBroadcast = async (formId: string) => {
        try {
            const confirmed = await Swal.fire({
                title: 'Apakah Anda yakin?',
                text: "Ini akan mengirimkan email broadcast ke semua pihak terkait (pengaju, manager, GM, HRD, Finance).",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Ya, Kirim Email!',
                cancelButtonText: 'Batal'
            }).then((result) => result.isConfirmed);

            if (!confirmed) {
                return;
            }

            Swal.fire({
                title: 'Sedang Mengirim Email...',
                text: 'Mohon tunggu sebentar.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await fetch('/api/send-full-broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formId }),
            });

            if (response.ok) {
                Swal.fire('Berhasil!', 'Email broadcast berhasil dikirim.', 'success');
            } else {
                Swal.fire('Gagal!', 'Gagal mengirim email broadcast. Silakan coba lagi.', 'error');
            }
        } catch (error) {
            console.error('Failed to send broadcast email:', error);
            Swal.fire('Error', 'Terjadi kesalahan saat mengirim email.', 'error');
        }
    };


    // Filter requests based on search query
    const filteredRequests = requests.filter(req => {
        const query = searchQuery.toLowerCase();
        const type = req.type ? req.type.toLowerCase() : "";
        const requester = req.requesterName ? req.requesterName.toLowerCase() : "";
        const requestId = req.id ? req.id.toLowerCase() : "";
        return type.includes(query) || requester.includes(query) || requestId.includes(query);
    });

    const getDeptName = (deptId: string) => {
        return departments[deptId]?.name || deptId;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "approved":
                return "bg-green-100 text-green-800";
            case "manager_approved":
                return "bg-blue-100 text-blue-800";
            case "gm_approved":
                return "bg-green-100 text-green-800";
            case "rejected":
                return "bg-red-100 text-red-800";
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "draft":
                return "bg-gray-200 text-gray-700";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };


    // Function to find the last approval step
    const getLastApprovalStep = (approvalFlow: ApprovalStep[]): ApprovalStep | undefined => {
        if (!approvalFlow || approvalFlow.length === 0) {
            return undefined;
        }
        // Find the last step that has been approved or rejected
        const finalStep = [...approvalFlow].reverse().find(step => step.status !== 'pending');
        return finalStep;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
                <div className="bg-white p-6 rounded-lg shadow-md max-w-md">
                    <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
                    <p className="text-gray-700 mb-4">{error}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
                <div className="bg-white p-6 rounded-lg shadow-md max-w-md text-center">
                    <p className="text-gray-600">
                      You must be logged in to view this page.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
             {/* Sidebar - Mobile View */}
            <div className={`fixed inset-y-0 left-0 z-50 md:hidden bg-white shadow-lg w-64 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
                <div className="p-4 border-b border-green-100 flex justify-end">
                    <button onClick={handleSidebarToggle} className="text-gray-500 hover:text-gray-700 focus:outline-none">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div className="p-4 border-b border-green-100 text-center">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-xl">POA</span>
                        </div>
                    </div>
                    <h1 className="text-lg font-bold text-center text-gray-800">Prestova One Approval</h1>
                </div>
                <nav className="p-4">
                    <ul className="space-y-2">
                        <li>
                            <Link href="/dashboard" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Dashboard
                            </Link>
                        </li>
                        <li>
                            <Link href="/approvals" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                <span className="mr-3">✅</span>
                                Approvals
                            </Link>
                        </li>
                        <li>
                            <Link href="/history" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                <span className="mr-3">📋</span>
                                My Requests
                            </Link>
                        </li>
                        <li>
                            <Link href="/forms" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                <span className="mr-3">➕</span>
                                New Request
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>

            {/* Sidebar - Desktop View */}
            <div className="hidden md:block w-64 bg-white shadow-lg">
                <div className="p-4 border-b border-green-100">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-xl">POA</span>
                        </div>
                    </div>
                    <h1 className="text-lg font-bold text-center text-gray-800">Prestova One Approval</h1>
                </div>

                <nav className="p-4">
                    <div className="mb-2">
                        <Link href="/dashboard" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition mb-4">
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </Link>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Main Menu</h2>
                        <ul className="space-y-1">
                            <li>
                                <Link href="/approvals" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                    <span className="mr-3">✅</span>
                                    Approvals
                                </Link>
                            </li>
                            <li>
                                <Link href="/history" className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                    <span className="mr-3">📋</span>
                                    My Requests
                                </Link>
                            </li>
                            <li>
                                <Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                    <span className="mr-3">➕</span>
                                    New Request
                                </Link>
                            </li>
                        </ul>
                    </div>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-green-100">
                    <div className="flex items-center justify-between p-4">
                        <div className="md:hidden">
                            <button onClick={handleSidebarToggle} className="text-gray-500 hover:text-gray-700 focus:outline-none">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                                </svg>
                            </button>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Form History</h1>
                            <p className="text-sm text-gray-500">Track and manage all submitted forms</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-600 hidden sm:inline">Welcome, {user?.nama || user?.displayName || user?.email}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${user?.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                user?.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                    user?.role === 'general_manager' ? 'bg-indigo-100 text-indigo-800' :
                                        user?.role === 'hrd' ? 'bg-yellow-100 text-yellow-800' :
                                            user?.role === 'finance' ? 'bg-green-100 text-green-800' :
                                                'bg-gray-100 text-gray-800'
                                }`}>
                                {user?.role || 'Unknown'}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="p-4 md:p-6">
                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-green-100">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                            <h2 className="text-xl font-semibold text-gray-900">Total Requests: {filteredRequests.length}</h2>
                            <div className="relative w-full sm:w-64">
                                <input
                                    type="text"
                                    placeholder="Search by ID, type, or requester..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {filteredRequests.length === 0 ? (
                            <div className="text-center py-8">
                                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-gray-500">No requests found.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredRequests.map(req => {
                                    const lastStep = getLastApprovalStep(req.approvalFlow);
                                    const createdAtDate = safeToDate(req.createdAt);
                                    const approvedAtDate = safeToDate(lastStep?.approvedAt);

                                    return (
                                        <div key={req.id} className="border border-gray-200 rounded-lg p-4 md:p-6 hover:shadow-md transition-shadow">
                                            <div className="flex flex-col sm:flex-row justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-semibold text-lg text-gray-900">
                                                        {req.type.toUpperCase()} - {req.deptId ? getDeptName(req.deptId) : req.dept}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 uppercase font-semibold">
                                                        Form ID: {req.id}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Requester: {req.requesterName}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Submission Date: {createdAtDate ? createdAtDate.toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col sm:items-end">
                                                    <span className={`mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                                                        {req.status.toUpperCase()}
                                                    </span>

                                                    {req.status === 'approved' && (
                                                        <button
                                                            onClick={() => handleSendEmailBroadcast(req.id)}
                                                            className="mt-2 px-4 py-2 bg-lime-500 text-white rounded-lg hover:bg-lime-600 transition text-sm font-medium"
                                                        >
                                                            Send Email Broadcast
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {lastStep && (
                                                <div className="mt-4 p-4 border-t border-gray-200 bg-gray-50 rounded-lg">
                                                    <p className="font-semibold text-sm text-gray-800">Last Step:</p>
                                                    <p className="text-sm text-gray-600">
                                                        Responsible Party: {lastStep.approvedByName || lastStep.approvedBy}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Status: <span className={`font-semibold ${lastStep.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{lastStep.status.toUpperCase()}</span>
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Date: {approvedAtDate ? approvedAtDate.toLocaleString() : 'N/A'}
                                                    </p>
                                                    {lastStep.comments && (
                                                        <p className="text-sm text-gray-600 mt-2">
                                                            Comment: <span className="italic">"{lastStep.comments}"</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}