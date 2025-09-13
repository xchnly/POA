"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc, query, where, orderBy, getDoc, Timestamp } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import Swal from 'sweetalert2';

// Interfaces (Pastikan ini sesuai dengan struktur data Anda di Firestore)
interface Employee {
  id: string;
  name: string;
  nik: string;
  dept: string;
  deptId?: string;
}

interface OvertimeEntry {
  employee: Employee;
  startTime: string;
  endTime: string;
  date: string;
  totalHours: number;
  breakTime: number;
}

interface LaborRequestDetails {
  tanggalDiperlukan: string;
  jumlahOrang: number;
  gender: string[];
  umurMaksimal: number;
  alasanMemerlukan: string;
  alasanLain?: string;
  posisi: string;
  tugasUtama: string;
  bahasaDiperlukan: string[];
  persyaratanLain: string;
}

interface PurchaseItem {
  id: string;
  no: number;
  kodeItem: string;
  namaItem: string;
  spek: string;
  qty: number;
  unit: string;
  alasan: string;
  remarks: string;
  photoUrl?: string;
}

interface ReimbursementItem {
  id: string;
  namaItem: string;
  harga: number;
  deskripsi: string;
}

interface CutiDetails {
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  jenisCuti: string;
  alasanCuti: string;
  tanggalDiajukan: string;
  alasan?: string;
  totalHari?: number;
}

// START: Interface untuk Cuti Sakit
interface SickLeaveEntry {
  employee: Employee;
  tanggalMulai: string;
  tanggalSelesai: string;
  totalHari: number;
  mcFileUrl?: string;
}
// END: Interface untuk Cuti Sakit

interface ApprovalStep {
  role: string;
  dept?: string;
  deptId?: string;
  status: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  comments?: string;
}

interface Request {
  id: string;
  type: string;
  employees?: Employee[];
  tanggal: string;
  dept?: string;
  deptId?: string;
  status: string;
  approvalFlow: ApprovalStep[];
  entries?: OvertimeEntry[] | SickLeaveEntry[];
  jenisPengajuan?: string;
  kategori?: string;
  requesterName?: string;
  requesterUid?: string;
  alasan?: string;
  createdAt?: any;
  updatedAt?: any;
  currentApprovalIndex?: number;
  purchaseItems?: PurchaseItem[];
  tanggalRequest?: string;
  mcFileUrl?: string;
  // START: Tambahan untuk Payment
  items?: ReimbursementItem[];
  totalHarga?: number;
  namaBank?: string;
  nomorRekening?: string;
  atasNamaRekening?: string;
  notaUrls?: string[];
  // END: Tambahan untuk Payment
  // START: Tambahan untuk Resign
  resignationDate?: string;
  employeeName?: string;
  employeeNik?: string;
  reason?: string;
  // END: Tambahan untuk Resign
  // START: Tambahan untuk Labor Request
  tanggalDiperlukan?: string;
  jumlahOrang?: number;
  gender?: string[];
  umurMaksimal?: number;
  alasanMemerlukan?: string;
  alasanLain?: string;
  posisi?: string;
  tugasUtama?: string;
  bahasaDiperlukan?: string[];
  persyaratanLain?: string;
  // END: Tambahan untuk Labor Request
  // START: Tambahan untuk Cuti
  tanggalMulai?: string;
  tanggalSelesai?: string;
  jumlahHari?: number;
  jenisCuti?: string;
  alasanCuti?: string;
  tanggalDiajukan?: string;
  // END: Tambahan untuk Cuti
  // Tambahan untuk Permission to Leave
  keperluan?: string;
  penjelasan?: string;
  jenisIzin?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  menggunakanKendaraan?: boolean;
  namaSupir?: string;
  platNomor?: string;
  bawaRekan?: boolean;
  rekan?: { nama: string; nik: string; dept: string }[];
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

export default function ApprovalsPage() {
  const [authUser] = useAuthState(auth);
  const [user, setUser] = useState<UserData | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [departments, setDepartments] = useState<Record<string, any>>({});
  const [managers, setManagers] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
            deptId: userData.dept || userData.deptId || "",
            nama: userData.nama || "",
            nik: userData.nik || "",
            jabatan: userData.jabatan || ""
          });
        } else {
          console.error("User document not found in Firestore");
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

        // Fetch managers data
        const managersSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "manager")));
        const managersData: Record<string, any> = {};
        managersSnapshot.forEach((doc) => {
          managersData[doc.id] = doc.data();
        });
        setManagers(managersData);

        let q;
        if (user.role === "manager") {
          q = query(
            collection(db, "forms"),
            where("deptId", "==", user.deptId),
            orderBy("createdAt", "desc")
          );
        } else if (user.role === "general_manager") {
          q = query(
            collection(db, "forms"),
            where("status", "==", "manager_approved"),
            orderBy("createdAt", "desc")
          );
        } else if (user.role === "hrd" || user.role === "finance") {
          q = query(
            collection(db, "forms"),
            where("status", "==", "gm_approved"),
            orderBy("createdAt", "desc")
          );
        } else if (user.role === "admin") {
          q = query(
            collection(db, "forms"),
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(
            collection(db, "forms"),
            where("requesterUid", "==", user.uid),
            orderBy("createdAt", "desc")
          );
        }

        const snapshot = await getDocs(q);
        const list: Request[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          let currentApprovalIndex = 0;
          let approvalFlow = data.approvalFlow || [];

          if (approvalFlow.length === 0) {
            console.log("Creating default approval flow for:", docSnap.id);
            const requestDeptId = data.deptId || data.dept;
            approvalFlow = [
              {
                role: "manager",
                deptId: requestDeptId,
                status: "pending"
              },
              {
                role: "general_manager",
                status: "pending"
              },
              {
                role: "hrd",
                status: "pending"
              }
            ];
          }

          if (approvalFlow) {
            for (let i = 0; i < approvalFlow.length; i++) {
              if (approvalFlow[i].status === "pending") {
                currentApprovalIndex = i;
                break;
              }
            }
          }

          const request: Request = {
            id: docSnap.id,
            type: data.type || "unknown",
            employees: data.employees || [],
            tanggal: data.tanggal || data.tanggalRequest || (data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : 'N/A'),
            dept: data.dept || "",
            deptId: data.deptId,
            status: data.status || "draft",
            approvalFlow: approvalFlow,
            entries: data.entries,
            jenisPengajuan: data.jenisPengajuan,
            kategori: data.kategori,
            requesterName: data.requesterName,
            requesterUid: data.requesterUid,
            alasan: data.alasan,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            currentApprovalIndex,
            // Data untuk Resign
            resignationDate: data.resignationDate,
            employeeName: data.employeeName,
            employeeNik: data.employeeNik,
            reason: data.reason,
            // Data untuk Labor Request
            tanggalDiperlukan: data.tanggalDiperlukan,
            jumlahOrang: data.jumlahOrang,
            gender: data.gender,
            umurMaksimal: data.umurMaksimal,
            alasanMemerlukan: data.alasanMemerlukan,
            alasanLain: data.alasanLain,
            posisi: data.posisi,
            tugasUtama: data.tugasUtama,
            bahasaDiperlukan: data.bahasaDiperlukan,
            persyaratanLain: data.persyaratanLain,
            // Data untuk Purchase Request
            purchaseItems: data.items || data.purchaseItems,
            tanggalRequest: data.tanggalRequest,
            // Data untuk Cuti
            tanggalMulai: data.tanggalMulai,
            tanggalSelesai: data.tanggalSelesai,
            jumlahHari: data.totalHari || data.jumlahHari,
            jenisCuti: data.jenisCuti,
            alasanCuti: data.alasan,
            tanggalDiajukan: data.tanggalDiajukan,
            // Data untuk Payment/Reimbursement
            items: data.items,
            totalHarga: data.totalHarga,
            namaBank: data.namaBank,
            nomorRekening: data.nomorRekening,
            atasNamaRekening: data.atasNamaRekening,
            notaUrls: data.notaUrls,
            // Tambahan untuk Permission to Leave
            keperluan: data.keperluan,
            penjelasan: data.penjelasan,
            jenisIzin: data.jenisIzin,
            waktuMulai: data.waktuMulai,
            waktuSelesai: data.waktuSelesai,
            menggunakanKendaraan: data.menggunakanKendaraan,
            namaSupir: data.namaSupir,
            platNomor: data.platNomor,
            bawaRekan: data.bawaRekan,
            rekan: data.rekan,
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

  const getDeptName = (deptId: string) => {
    return departments[deptId]?.name || deptId;
  };

  const getManagerName = (managerId: string) => {
    return managers[managerId]?.nama || managerId;
  };

  const canApprove = (req: Request) => {
    if (!user) return false;

    if (user.role === "manager") {
      return (req.status === "draft" || req.status === "pending") && req.deptId === user.deptId;
    }

    if (user.role === "general_manager") {
      return req.status === "manager_approved";
    }

    if (user.role === "hrd" || user.role === "finance") {
      return req.status === "gm_approved";
    }

    return false;
  };
  
  // Mengubah fungsi ini untuk menggunakan SweetAlert
  const handleApprovalAction = async (reqId: string, action: "approved" | "rejected") => {
    if (!user) {
        await Swal.fire({
            icon: 'error',
            title: 'Unauthorized',
            text: 'You are not authorized to perform this action.'
        });
        return;
    }

    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    if (!canApprove(req)) {
        await Swal.fire({
            icon: 'error',
            title: 'Unauthorized',
            text: 'You are not authorized to approve this request at this time.'
        });
        return;
    }

    const result = await Swal.fire({
        title: `Are you sure you want to ${action}?`,
        text: `You are about to ${action} this request. This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: action === "approved" ? '#3085d6' : '#d33',
        cancelButtonColor: '#aaa',
        confirmButtonText: action === "approved" ? 'Yes, approve it!' : 'Yes, reject it!',
        input: 'textarea',
        inputPlaceholder: 'Add a comment (optional)',
        inputAttributes: {
            'aria-label': 'Type your comment here'
        }
    });

    if (result.isConfirmed) {
      // Panggil fungsi persetujuan utama
      await confirmApproval(reqId, action, result.value);
    }
  };

  const confirmApproval = async (reqId: string, action: "approved" | "rejected", comment: string) => {
    try {
      const formRef = doc(db, "forms", reqId);
      const req = requests.find(r => r.id === reqId);

      if (!req) return;

      let nextStatus = "";
      if (action === "rejected") {
        nextStatus = "rejected";
      } else if (user?.role === "manager") {
        nextStatus = "manager_approved";
      } else if (user?.role === "general_manager") {
        nextStatus = "gm_approved";
      } else if (user?.role === "hrd" || user?.role === "finance") {
        nextStatus = "approved";
      }

      const updatedApprovalFlow = [...req.approvalFlow];
      const currentStepIndex = req.currentApprovalIndex || 0;

      if (currentStepIndex < updatedApprovalFlow.length) {
        updatedApprovalFlow[currentStepIndex] = {
          ...updatedApprovalFlow[currentStepIndex],
          status: action === "approved" ? "approved" : "rejected",
          approvedAt: new Date().toISOString(),
          approvedBy: user?.uid,
          approvedByName: user?.nama || user?.displayName || user?.email || "Unknown",
          comments: comment
        };
      }

      await updateDoc(formRef, {
        status: nextStatus,
        approvalFlow: updatedApprovalFlow,
        updatedAt: Timestamp.now()
      });

      setRequests(prev => prev.map(r => {
        if (r.id === reqId) {
          return {
            ...r,
            status: nextStatus,
            approvalFlow: updatedApprovalFlow
          };
        }
        return r;
      }));

      Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: `Request has been ${action} successfully!`,
          showConfirmButton: false,
          timer: 2000
      });

    } catch (err) {
      console.error("Error updating approval:", err);
      Swal.fire({
          icon: 'error',
          title: 'Error!',
          text: 'Error updating approval. Please try again.'
      });
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") {
      return canApprove(req);
    }
    return req.status === filterStatus;
  });

  const getStatusFilterOptions = () => {
    return [
      { value: "all", label: "All Requests" },
      { value: "pending", label: "Pending My Approval" }
    ];
  };

  const handleSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
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

  const allowedRoles = ["manager", "general_manager", "hrd", "finance", "admin"];

  if (!user || !allowedRoles.includes(user.role.toLowerCase())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md text-center">
          <p className="text-gray-600">
            You do not have access rights to view this page.
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
              <Link href="/approvals" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                <span className="mr-3">✅</span>
                Approvals
              </Link>
            </li>
            <li>
              <Link href="/history" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
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
                <Link href="/approvals" className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                  <span className="mr-3">✅</span>
                  Approvals
                </Link>
              </li>
              <li>
                <Link href="/history" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
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
              <h1 className="text-2xl font-bold text-gray-900">Approval Requests</h1>
              <p className="text-sm text-gray-500">Review and approve pending requests</p>
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
          {/* Filter Section */}
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-4 md:mb-6 border border-green-100">
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center">
              <label htmlFor="filterStatus" className="text-sm font-medium text-gray-700">Filter Status:</label>
              <select
                id="filterStatus"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition w-full sm:w-auto"
              >
                {getStatusFilterOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600">
                Showing {filteredRequests.length} of {requests.length} requests
              </span>
            </div>
          </div>

          {/* Requests List */}
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-green-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Request List</h2>

            {filteredRequests.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">No requests found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map(req => (
                  <div key={req.id} className="border border-gray-200 rounded-lg p-4 md:p-6 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">
                          {req.type.toUpperCase()} - {req.deptId ? getDeptName(req.deptId) : req.dept}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Date: {req.tanggal} | Created: {req.createdAt ? new Date(req.createdAt.toDate()).toLocaleString() : 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 font-semibold">Requested by: {req.requesterName}</p>
                        {req.alasan && (
                          <p className="text-sm text-gray-600 mt-1">Reason: {req.alasan}</p>
                        )}
                      </div>
                      <span
                        className={`mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium ${req.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : req.status === "manager_approved"
                              ? "bg-blue-100 text-blue-800"
                              : req.status === "gm_approved"
                                ? "bg-green-100 text-green-800"
                                : req.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : req.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : req.status === "draft"
                                      ? "bg-gray-100 text-gray-800"
                                      : "bg-gray-100 text-gray-800"
                          }`}
                      >
                        {req.status.toUpperCase()}
                      </span>

                    </div>

                    {/* Overtime Details */}
                    {req.type === "overtime" && req.entries && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Overtime Details:</p>
                        {req.entries.map((entry: any, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg mb-2">
                            <p className="text-sm"><strong>Employee:</strong> {entry.employee.nama} ({entry.employee.nik})</p>
                            <p className="text-sm"><strong>Date:</strong> {entry.tanggal}</p>
                            <p className="text-sm"><strong>Time:</strong> {entry.jamMulai} - {entry.jamSelesai}</p>
                            <p className="text-sm"><strong>Break:</strong> {entry.breakTime} Menit</p>
                            <p className="text-sm"><strong>Total Hours:</strong> {entry.totalJam} hours</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Permission to Leave Details */}
                    {req.type === "permission-to-leave" && (
                        <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Permission to Leave Details:</p>
                            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                                <p className="text-sm"><strong>Request for:</strong> {req.jenisPengajuan === "diri-sendiri" ? "Self" : "Team Member"}</p>
                                <p className="text-sm"><strong>Purpose:</strong> {req.keperluan}</p>
                                <p className="text-sm"><strong>Explanation:</strong> {req.penjelasan}</p>
                                <p className="text-sm"><strong>Date:</strong> {req.tanggal}</p>
                                <p className="text-sm"><strong>Leave Type:</strong> {req.jenisIzin}</p>
                                {(req.jenisIzin === "meninggalkan-kantor" || req.jenisIzin === "datang-terlambat") && (
                                    <p className="text-sm"><strong>Start Time:</strong> {req.waktuMulai}</p>
                                )}
                                {(req.jenisIzin === "meninggalkan-kantor" || req.jenisIzin === "pulang-lebih-awal") && (
                                    <p className="text-sm"><strong>End Time:</strong> {req.waktuSelesai}</p>
                                )}
                                <p className="text-sm"><strong>Using Vehicle:</strong> {req.menggunakanKendaraan ? "Yes" : "No"}</p>
                                {req.menggunakanKendaraan && (
                                    <>
                                        <p className="text-sm"><strong>Driver Name:</strong> {req.namaSupir}</p>
                                        <p className="text-sm"><strong>Plate Number:</strong> {req.platNomor}</p>
                                    </>
                                )}
                                <p className="text-sm"><strong>Bringing Colleague:</strong> {req.bawaRekan ? "Yes" : "No"}</p>
                                {req.bawaRekan && req.rekan && req.rekan.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-sm font-semibold">Colleagues List:</p>
                                        <ul className="list-disc list-inside text-sm ml-4">
                                            {req.rekan.map((r, i) => (
                                                <li key={i}>{r.nama} ({r.nik}) - {r.dept}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Labor Request Details */}
                    {req.type === "labor" && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Labor Request Details:</p>
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                          <p className="text-sm"><strong>Position:</strong> {req.posisi}</p>
                          <p className="text-sm"><strong>Required Date:</strong> {req.tanggalDiperlukan}</p>
                          <p className="text-sm"><strong>Number of People:</strong> {req.jumlahOrang}</p>
                          <p className="text-sm"><strong>Max Age:</strong> {req.umurMaksimal} years</p>
                          <p className="text-sm"><strong>Gender:</strong> {req.gender?.join(", ")}</p>
                          <p className="text-sm"><strong>Reason:</strong> {req.alasanMemerlukan}{req.alasanLain && `: ${req.alasanLain}`}</p>
                          <p className="text-sm"><strong>Main Task:</strong> {req.tugasUtama}</p>
                          <p className="text-sm"><strong>Required Language:</strong> {req.bahasaDiperlukan?.join(", ")}</p>
                          {req.persyaratanLain && (
                            <p className="text-sm"><strong>Other Requirements:</strong> {req.persyaratanLain}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Purchase Request Details */}
                    {req.type === "purchase" && req.purchaseItems && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Purchase Request Details:</p>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm"><strong>Request Date:</strong> {req.tanggalRequest}</p>
                          <p className="text-sm mt-2"><strong>Items:</strong></p>
                          <ul className="list-disc list-inside ml-4 space-y-1">
                            {req.purchaseItems.map((item, index) => (
                              <li key={item.id || index} className="text-sm">
                                {item.qty} {item.unit} of "{item.namaItem}" ({item.kodeItem})
                                <span className="text-gray-500 italic ml-2"> - {item.alasan}</span>
                                {item.remarks && <span className="text-gray-500 ml-2">({item.remarks})</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Leave Request Details */}
                    {req.type === "cuti" && req.tanggalMulai && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Leave Request Details:</p>
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                          <p className="text-sm"><strong>Leave Type:</strong> {req.jenisCuti}</p>
                          <p className="text-sm"><strong>Start Date:</strong> {req.tanggalMulai}</p>
                          <p className="text-sm"><strong>End Date:</strong> {req.tanggalSelesai}</p>
                          <p className="text-sm"><strong>Total Days:</strong> {req.jumlahHari} days</p>
                          <p className="text-sm"><strong>Reason:</strong> {req.alasanCuti}</p>
                          <p className="text-sm"><strong>Date Submitted:</strong> {req.tanggalDiajukan}</p>
                        </div>
                      </div>
                    )}

                    {/* START: Tambahan untuk detail Cuti Sakit */}
                    {req.type === "sick_leave" && req.entries && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Sick Leave Details:</p>
                        {req.entries.map((entry: any, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg mb-2">
                            <p className="text-sm"><strong>Employee:</strong> {entry.employee?.nama} ({entry.employee?.nik})</p>
                            <p className="text-sm"><strong>Department:</strong> {entry.employee?.dept}</p>
                            <p className="text-sm"><strong>Date:</strong> {entry.tanggalMulai} to {entry.tanggalSelesai}</p>
                            <p className="text-sm"><strong>Total Days:</strong> {entry.totalHari} days</p>
                            {entry.mcFileUrl && (
                              <div className="mt-2">
                                <a
                                  href={entry.mcFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                  View MC
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M11 3a1 1 0 100 2h3.586l-7.293 7.293a1 1 0 101.414 1.414L16 6.414V10a1 1 0 102 0V4a1 1 0 00-1-1h-6z" />
                                    <path d="M4 12a1 1 0 00-1 1v2a2 2 0 002 2h2a1 1 0 000-2H5v-2a1 1 0 00-1-1z" />
                                  </svg>
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* END: Tambahan untuk detail Cuti Sakit */}

                    {/* START: Tambahan untuk detail Payment (Reimbursement) */}
                    {req.jenisPengajuan === "reimbursement" && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Reimbursement Details:</p>
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                          <p className="text-sm"><strong>Reason:</strong> {req.alasan}</p>

                          <h4 className="font-semibold text-gray-800 mt-4">Item List:</h4>
                          {req.items && req.items.length > 0 ? (
                            <ul className="list-disc list-inside ml-4 space-y-1">
                              {req.items.map((item, index) => (
                                <li key={item.id || index} className="text-sm">
                                  {item.namaItem} - Rp {item.harga?.toLocaleString('id-ID')}
                                  {item.deskripsi && <span className="text-gray-500 italic ml-2">({item.deskripsi})</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm italic text-gray-500">No items listed.</p>
                          )}

                          <div className="text-right mt-4 pt-2 border-t border-gray-200">
                            <h4 className="text-base font-bold text-gray-900">Total Cost: Rp {req.totalHarga?.toLocaleString('id-ID')}</h4>
                          </div>

                          <h4 className="font-semibold text-gray-800 mt-4">Uploaded Receipts:</h4>
                          {req.notaUrls && req.notaUrls.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {req.notaUrls.map((url, index) => (
                                <a
                                  key={index}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                  View Receipt #{index + 1}
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M11 3a1 1 0 100 2h3.586l-7.293 7.293a1 1 0 101.414 1.414L16 6.414V10a1 1 0 102 0V4a1 1 0 00-1-1h-6z" />
                                    <path d="M4 12a1 1 0 00-1 1v2a2 2 0 002 2h2a1 1 0 000-2H5v-2a1 1 0 00-1-1z" />
                                  </svg>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm italic text-gray-500">No receipts uploaded.</p>
                          )}
                        </div>
                      </div>
                    )}
                    {/* END: Tambahan untuk detail Payment (Reimbursement) */}

                    {/* START: Tambahan untuk detail Resign */}
                    {req.type === "resign" && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Resign Details:</p>
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                          <p className="text-sm"><strong>Employee:</strong> {req.employeeName} ({req.employeeNik})</p>
                          <p className="text-sm"><strong>Department:</strong> {req.dept}</p>
                          <p className="text-sm"><strong>Resignation Date:</strong> {req.resignationDate}</p>
                          <p className="text-sm"><strong>Reason:</strong> {req.reason}</p>
                          <p className="text-sm"><strong>Requested by:</strong> {req.requesterName}</p>
                        </div>
                      </div>
                    )}
                    {/* END: Tambahan untuk detail Resign */}

                    {/* Approval Flow */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Approval Flow:</p>
                      <div className="flex flex-wrap gap-2">
                        {req.approvalFlow.filter(step => step.role.toLowerCase() !== 'hrd').map((step, idx) => (
                          <div
                            key={idx}
                            className={`px-3 py-2 rounded-lg text-xs font-medium max-w-xs ${step.status === 'approved' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' :
                              step.status === 'rejected' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' :
                                idx === (req.currentApprovalIndex || 0) && step.status !== 'approved' && step.status !== 'rejected' ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' :
                                  'bg-gray-100 text-gray-800'
                              }`}
                          >
                            <div className="font-semibold">
                              {step.role.toUpperCase()}{step.deptId ? ` (${getDeptName(step.deptId)})` : ''}
                            </div>
                            <div className="mt-1">
                              Status: {step.status.toUpperCase()}
                              {step.approvedBy && (
                                <div className="mt-1">
                                  By: {step.approvedByName || step.approvedBy}
                                  {step.approvedAt && (
                                    <div className="text-xs text-gray-500">
                                      {new Date(step.approvedAt).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              )}
                              {step.comments && (
                                <div className="mt-1 p-1 bg-white rounded text-gray-700">
                                  <strong>Comment:</strong> {step.comments}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Approval Buttons */}
                    {canApprove(req) && (
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprovalAction(req.id, "approved")}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprovalAction(req.id, "rejected")}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}