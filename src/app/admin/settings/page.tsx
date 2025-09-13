"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from 'sweetalert2';

interface UserData {
    uid: string;
    nama: string;
    role: string;
    dept: string;
    jabatan: string;
    email: string;
    nik: string;
}

interface Department {
    id: string;
    name: string;
}

interface BroadcastEmails {
    hrd: string[];
    finance: string[];
    general_manager: string[];
    managers: { [key: string]: string[] };
}

const SettingPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<UserData | null>(null);
    const [users, setUsers] = useState<UserData[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editedUser, setEditedUser] = useState<Partial<UserData> | null>(null);
    const [broadcastEmails, setBroadcastEmails] = useState<BroadcastEmails>({ hrd: [''], finance: [''], general_manager: [''], managers: {} });

    const router = useRouter();

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const usersList = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UserData[];
            setUsers(usersList);

            const deptsSnapshot = await getDocs(collection(db, "departments"));
            const deptsList = deptsSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name
            })) as Department[];
            setDepartments(deptsList);

            const settingsDocRef = doc(db, "settings", "broadcast_emails");
            const settingsSnap = await getDoc(settingsDocRef);
            if (settingsSnap.exists()) {
                const data = settingsSnap.data() as BroadcastEmails;
                setBroadcastEmails({
                    hrd: data.hrd.length > 0 ? data.hrd : [''],
                    finance: data.finance.length > 0 ? data.finance : [''],
                    general_manager: data.general_manager?.length > 0 ? data.general_manager : [''],
                    managers: data.managers || {}
                });
            } else {
                setBroadcastEmails({
                    hrd: [''],
                    finance: [''],
                    general_manager: [''],
                    managers: {}
                });
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            Swal.fire('Error', 'Failed to load data. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const allowedRoles = ["admin", "hrd", "manager", "general_manager"];
                if (userDoc.exists() && allowedRoles.includes(userDoc.data().role)) {
                    setCurrentUser(userDoc.data() as UserData);
                    fetchAllData();
                } else {
                    router.push("/dashboard");
                }
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    // Handle user actions
    const handleEditClick = (user: UserData) => {
        setIsEditing(user.uid);
        setEditedUser({ ...user });
    };

    const handleCancelEdit = () => {
        setIsEditing(null);
        setEditedUser(null);
    };

    const handleSaveUser = async () => {
        if (!isEditing || !editedUser) return;
        try {
            await updateDoc(doc(db, "users", isEditing), editedUser);
            await Swal.fire('Success!', 'User updated successfully.', 'success');
            await fetchAllData();
            handleCancelEdit();
        } catch (error) {
            console.error("Error updating user:", error);
            Swal.fire('Error', 'Failed to update user. Please try again.', 'error');
        }
    };

    const handleDeleteUser = async (uid: string) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "users", uid));
                await Swal.fire('Deleted!', 'The user has been deleted.', 'success');
                setUsers(users.filter(user => user.uid !== uid));
            } catch (error) {
                console.error("Error deleting user:", error);
                Swal.fire('Error', 'Failed to delete user. Please try again.', 'error');
            }
        }
    };

    // Handle broadcast email settings
    const handleAddEmail = (category: 'hrd' | 'finance' | 'general_manager', deptId?: string) => {
        setBroadcastEmails(prev => {
            if (category === 'hrd' || category === 'finance' || category === 'general_manager') {
                if (prev[category].length < 5) {
                    return { ...prev, [category]: [...prev[category], ''] };
                }
            } else if (deptId) {
                const newManagers = { ...prev.managers };
                if ((newManagers[deptId] || []).length < 5) {
                    newManagers[deptId] = [...(newManagers[deptId] || []), ''];
                }
                return { ...prev, managers: newManagers };
            }
            return prev;
        });
    };

    const handleEmailChange = (role: 'hrd' | 'finance' | 'general_manager', index: number, value: string) => {
        const newEmails = [...broadcastEmails[role]];
        newEmails[index] = value;
        setBroadcastEmails(prev => ({ ...prev, [role]: newEmails }));
    };

    const handleManagerEmailChange = (deptId: string, index: number, value: string) => {
        const newManagers = { ...broadcastEmails.managers };
        const newEmails = [...(newManagers[deptId] || [])];
        newEmails[index] = value;
        newManagers[deptId] = newEmails;
        setBroadcastEmails(prev => ({ ...prev, managers: newManagers }));
    };

    const handleSaveEmails = async () => {
        try {
            const settingsDocRef = doc(db, "settings", "broadcast_emails");
            const cleanedEmails = {
                hrd: broadcastEmails.hrd.filter(email => email.trim() !== ''),
                finance: broadcastEmails.finance.filter(email => email.trim() !== ''),
                general_manager: broadcastEmails.general_manager.filter(email => email.trim() !== ''),
                managers: Object.entries(broadcastEmails.managers).reduce((acc, [deptId, emails]) => {
                    acc[deptId] = emails.filter(email => email.trim() !== '');
                    return acc;
                }, {} as { [key: string]: string[] })
            };
            await setDoc(settingsDocRef, cleanedEmails, { merge: true });
            await Swal.fire('Success!', 'Email settings saved successfully.', 'success');
        } catch (error) {
            console.error("Error saving email settings:", error);
            Swal.fire('Error', 'Failed to save email settings. Please try again.', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
            {/* Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}
            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
                <div className="p-4 border-b border-green-100">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-xl">POA</span>
                        </div>
                    </div>
                    <h1 className="text-lg font-bold text-center text-gray-800">Prestova One Approval</h1>
                </div>
                <nav className="p-4">
                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Main Menu</h2>
                        <ul className="space-y-2">
                            <li><Link href="/dashboard" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>Dashboard</Link></li>
                            <li><Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Submit Form</Link></li>
                            <li><Link href="/approvals" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Approvals</Link></li>
                            <li><Link href="/history" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>History</Link></li>
                        </ul>
                    </div>
                    {currentUser && ["admin", "hrd", "manager", "general_manager"].includes(currentUser.role as string) && (
                        <div className="mb-6">
                            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Administration</h2>
                            <ul className="space-y-2">
                                <li><Link href="/admin/users" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>User Management</Link></li>
                                <li><Link href="/admin/recapitulation" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-6m2 12H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Recapitulation</Link></li>
                                <li><Link href="/admin/settings" className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.82 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.82 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.82-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.82-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Setting
                                </Link></li>
                                <li><Link href="/register" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-3"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>Register</Link></li>
                            </ul>
                        </div>
                    )}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-green-100 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="md:hidden p-2 mr-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900">System Settings</h1>
                                <p className="text-xs md:text-sm text-gray-500">Manage users and broadcast email lists</p>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleSaveEmails}
                                className="px-4 py-2 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                            >
                                Save Settings
                            </button>
                        </div>
                    </div>
                </header>

                <main className="p-4 md:p-6 space-y-6">
                    {/* User Management Section (Only visible to Admin) */}
                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-green-100">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">User Management</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase">Name</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase">NIK</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase">Email</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase">Role</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase">Department</th>
                                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {users.map((user) => (
                                        <tr key={user.uid} className="hover:bg-green-50">
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {user.nama}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                                                {user.nik}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                                                {user.email}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                                                {isEditing === user.uid ? (
                                                    <select
                                                        value={editedUser?.role || ''}
                                                        onChange={(e) => setEditedUser(prev => ({ ...prev, role: e.target.value }))}
                                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                                                    >
                                                        <option value="staff">Staff</option>
                                                        <option value="manager">Manager</option>
                                                        <option value="hrd">HRD</option>
                                                        <option value="general_manager">General Manager</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                ) : (
                                                    user.role
                                                )}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                                                {isEditing === user.uid ? (
                                                    <select
                                                        value={editedUser?.dept || ''}
                                                        onChange={(e) => setEditedUser(prev => ({ ...prev, dept: e.target.value }))}
                                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                                                    >
                                                        {departments.map(dept => (
                                                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    departments.find(d => d.id === user.dept)?.name || user.dept
                                                )}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                {isEditing === user.uid ? (
                                                    <>
                                                        <button onClick={handleSaveUser} className="text-green-600 hover:text-green-900">Save</button>
                                                        <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-900">Cancel</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleEditClick(user)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                                        <button onClick={() => handleDeleteUser(user.uid)} className="text-red-600 hover:text-red-900">Delete</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Broadcast Email Settings Section */}
                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-green-100">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Broadcast Email Lists</h2>
                        <p className="text-sm text-gray-500 mb-4">Enter up to 5 email addresses for each category.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* HRD Emails */}
                            <div className="space-y-4">
                                <h3 className="text-md font-medium text-gray-900">HRD Emails</h3>
                                {broadcastEmails.hrd.map((email, i) => (
                                    <input
                                        key={`hrd-${i}`}
                                        type="email"
                                        placeholder={`HRD Email ${i + 1}`}
                                        value={email}
                                        onChange={(e) => handleEmailChange('hrd', i, e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    />
                                ))}
                                {broadcastEmails.hrd.length < 5 && (
                                    <button onClick={() => handleAddEmail('hrd')} className="text-sm text-green-600 font-medium hover:underline">
                                        + Add Email
                                    </button>
                                )}
                            </div>

                            {/* Finance Emails */}
                            <div className="space-y-4">
                                <h3 className="text-md font-medium text-gray-900">Finance Emails</h3>
                                {broadcastEmails.finance.map((email, i) => (
                                    <input
                                        key={`finance-${i}`}
                                        type="email"
                                        placeholder={`Finance Email ${i + 1}`}
                                        value={email}
                                        onChange={(e) => handleEmailChange('finance', i, e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    />
                                ))}
                                {broadcastEmails.finance.length < 5 && (
                                    <button onClick={() => handleAddEmail('finance')} className="text-sm text-green-600 font-medium hover:underline">
                                        + Add Email
                                    </button>
                                )}
                            </div>

                            {/* General Manager Emails */}
                            <div className="space-y-4">
                                <h3 className="text-md font-medium text-gray-900">General Manager Emails</h3>
                                {broadcastEmails.general_manager.map((email, i) => (
                                    <input
                                        key={`general_manager-${i}`}
                                        type="email"
                                        placeholder={`General Manager Email ${i + 1}`}
                                        value={email}
                                        onChange={(e) => handleEmailChange('general_manager', i, e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    />
                                ))}
                                {broadcastEmails.general_manager.length < 5 && (
                                    <button onClick={() => handleAddEmail('general_manager')} className="text-sm text-green-600 font-medium hover:underline">
                                        + Add Email
                                    </button>
                                )}
                            </div>

                            {/* Manager Emails */}
                            <div className="space-y-4">
                                <h3 className="text-md font-medium text-gray-900">Manager Emails</h3>
                                {departments.filter(d => d.name.toLowerCase() !== 'hrd' && d.name.toLowerCase() !== 'finance').map(dept => (
                                    <div key={dept.id} className="space-y-2 border-t pt-2 mt-2">
                                        <p className="text-sm font-semibold text-gray-700">{dept.name} Manager Emails:</p>
                                        {(broadcastEmails.managers[dept.id] || ['']).map((email, i) => (
                                            <input
                                                key={`manager-${dept.id}-${i}`}
                                                type="email"
                                                placeholder={`${dept.name} Manager Email ${i + 1}`}
                                                value={email}
                                                onChange={(e) => handleManagerEmailChange(dept.id, i, e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                            />
                                        ))}
                                        {(broadcastEmails.managers[dept.id] || ['']).length < 5 && (
                                            <button onClick={() => handleAddEmail('managers', dept.id)} className="text-sm text-green-600 font-medium hover:underline">
                                                + Add Email
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SettingPage;