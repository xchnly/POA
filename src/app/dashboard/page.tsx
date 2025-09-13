"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";

interface UserData {
  uid: string;
  nama: string;
  role: string;
  dept: string;
  jabatan: string;
}

interface FormSummary {
  id: string;
  type: string;
  status: string;
  createdAt: Timestamp;
  requesterName: string;
}

const DashboardPage: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [deptName, setDeptName] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [submittedThisMonth, setSubmittedThisMonth] = useState<number>(0);
  const [approvedThisMonth, setApprovedThisMonth] = useState<number>(0);
  const [rejectedThisMonth, setRejectedThisMonth] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<FormSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDocs(
            query(collection(db, "users"), where("uid", "==", user.uid))
          );

          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data() as UserData;
            setUser(userData);

            const deptRef = doc(db, "departments", userData.dept);
            const deptSnap = await getDoc(deptRef);
            if (deptSnap.exists()) {
              setDeptName(deptSnap.data().name);
            }

            await loadDashboardData(userData);
          }
        } catch (error) {
          console.error("Error fetching user or department data:", error);
        }
      } else {
        router.push("/");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadDashboardData = async (userData: UserData) => {
    try {
      if (userData.role !== "staff") {
        const pendingQuery = query(
          collection(db, "forms"),
          where("status", "==", "in_review"),
          where(`approvers.${userData.role}`, "==", userData.uid)
        );
        const pendingSnapshot = await getDocs(pendingQuery);
        setPendingApprovals(pendingSnapshot.size);
      } else {
        setPendingApprovals(0);
      }

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const startOfMonth = new Date(currentYear, currentMonth, 1);

      const submittedQuery = query(
        collection(db, "forms"),
        where("requesterUid", "==", userData.uid),
        where("createdAt", ">=", startOfMonth),
        where("status", "in", ["pending", "submitted", "in_review", "approved", "rejected", "manager_approved", "gm_approved"])
      );
      const submittedSnapshot = await getDocs(submittedQuery);
      setSubmittedThisMonth(submittedSnapshot.size);

      const approvedQuery = query(
        collection(db, "forms"),
        where("requesterUid", "==", userData.uid),
        where("createdAt", ">=", startOfMonth),
        where("status", "==", "gm_approved")
      );
      const approvedSnapshot = await getDocs(approvedQuery);
      setApprovedThisMonth(approvedSnapshot.size);

      const rejectedQuery = query(
        collection(db, "forms"),
        where("requesterUid", "==", userData.uid),
        where("createdAt", ">=", startOfMonth),
        where("status", "==", "rejected")
      );
      const rejectedSnapshot = await getDocs(rejectedQuery);
      setRejectedThisMonth(rejectedSnapshot.size);

      const activityQuery = query(
        collection(db, "forms"),
        where("requesterUid", "==", userData.uid),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const activitySnapshot = await getDocs(activityQuery);
      const activityData = activitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FormSummary[];
      setRecentActivity(activityData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "in_review": return "bg-yellow-100 text-yellow-800";
      case "draft": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
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
      {/* Mobile header */}
      <header className="w-full md:hidden bg-white shadow-sm border-b border-green-100">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <button aria-label="Open menu" onClick={() => setSidebarOpen(true)} className="p-2 rounded-md hover:bg-gray-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="w-10 h-8 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold">POA</span>
            </div>
            <h1 className="text-lg font-semibold">Dashboard</h1>
          </div>
          <div>
            <button onClick={handleLogout} className="bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white py-1.5 px-3 rounded-md text-sm">Logout</button>
          </div>
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <aside className={`hidden md:block md:w-64 bg-white shadow-lg shrink-0`}>
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
              <li>
                <Link href="/dashboard" className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2" />
                  </svg>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Submit Form
                </Link>
              </li>
              <li>
                <Link href="/approvals" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Approvals
                  {pendingApprovals > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {pendingApprovals}
                    </span>
                  )}
                </Link>
              </li>
              <li>
                <Link href="/history" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  History
                </Link>
              </li>
            </ul>
          </div>

          { ["admin", "hrd", "manager", "general_manager"].includes(user?.role as string) && (
            <div className="mb-6">
              <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Administration</h2>
              <ul className="space-y-2">
                <li>
                  <Link href="/admin/users" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    User Management
                  </Link>
                </li>
                <li>
                  <Link href="/admin/recapitulation" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-6m2 12H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Recapitulation
                  </Link>
                </li>
                <li>
                  <Link href="/admin/settings" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.82 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.82 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.82-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.82-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Setting
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                    </svg>
                    Register
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </nav>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-lg p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">POA</span>
                </div>
                <h2 className="font-semibold">Prestova One</h2>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-md hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav>
              <ul className="space-y-2">
                <li>
                  <Link href="/dashboard" className="block p-2 rounded-md bg-green-50 text-green-700">Dashboard</Link>
                </li>
                <li>
                  <Link href="/forms" className="block p-2 rounded-md">Submit Form</Link>
                </li>
                <li>
                  <Link href="/approvals" className="block p-2 rounded-md">Approvals</Link>
                </li>
                <li>
                  <Link href="/history" className="block p-2 rounded-md">History</Link>
                </li>
              </ul>
              <hr className="py-1"/>
              <ul className="space-y-2">
                <li>
                  <Link href="/admin/users" className="block p-2 rounded-md ">User</Link>
                </li>
                <li>
                  <Link href="/admin/recapitulation" className="block p-2 rounded-md">Recapitulation</Link>
                </li>
                <li>
                  <Link href="/admin/settings" className="block p-2 rounded-md">Setting</Link>
                </li>
                <li>
                  <Link href="/register" className="block p-2 rounded-md">Register</Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content area */}
      <main className="flex-1 overflow-auto">
        {/* Desktop header (inside main) */}
        <div className="hidden md:block bg-white shadow-sm border-b border-green-100">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-medium text-gray-900">Hello, {user?.nama}</p>
                <p className="text-sm text-gray-500 capitalize">{user?.role} • {deptName}</p>
              </div>
              <button onClick={handleLogout} className="bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white py-2 px-4 rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition-all duration-200">Logout</button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-full">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {user?.role !== "staff" && (
              <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-green-100">
                <div className="flex items-center">
                  <div className="rounded-lg bg-green-100 p-3 mr-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending Approvals</p>
                    <p className="text-2xl font-bold text-gray-900">{pendingApprovals}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-green-100">
              <div className="flex items-center">
                <div className="rounded-lg bg-blue-100 p-3 mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Submitted This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{submittedThisMonth}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-green-100">
              <div className="flex items-center">
                <div className="rounded-lg bg-purple-100 p-3 mr-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Approved This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{approvedThisMonth}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-green-100">
              <div className="flex items-center">
                <div className="rounded-lg bg-red-100 p-3 mr-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Rejected This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{rejectedThisMonth}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6 border border-green-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link href="/forms/cuti" className="flex flex-col items-center justify-center p-3 border border-green-200 rounded-lg hover:bg-green-50 transition">
                <div className="bg-green-100 p-2 rounded-lg mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500">Submit Leave</span>
              </Link>

              <Link href="/forms/overtime" className="flex flex-col items-center justify-center p-3 border border-green-200 rounded-lg hover:bg-green-50 transition">
                <div className="bg-green-100 p-2 rounded-lg mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500">Submit Overtime</span>
              </Link>

              <Link href="/forms/purchase" className="flex flex-col items-center justify-center p-3 border border-green-200 rounded-lg hover:bg-green-50 transition">
                <div className="bg-green-100 p-2 rounded-lg mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500">Purchase Order</span>
              </Link>

              <Link href="/forms/labor" className="flex flex-col items-center justify-center p-3 border border-green-200 rounded-lg hover:bg-green-50 transition">
                <div className="bg-green-100 p-2 rounded-lg mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500">Labor Request</span>
              </Link>
            </div>
          </div>

          {/* Recent Activity (responsive table) */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-green-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Form Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => (
                      <tr key={activity.id} className="hover:bg-green-50">
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">{activity.type}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{activity.createdAt?.toDate?.().toLocaleDateString('en-US')}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                            {activity.status === "in_review" ? "In Review" :
                              activity.status === "approved" ? "Approved" :
                                activity.status === "rejected" ? "Rejected" :
                                  activity.status === "draft" ? "Draft" : "Submitted"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-4 px-3 text-center text-sm text-gray-500">No recent activity found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;