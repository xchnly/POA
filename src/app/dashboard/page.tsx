"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  createdAt: any;
  requesterName: string;
}

const DashboardPage: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [draftCount, setDraftCount] = useState<number>(0);
  const [submittedThisMonth, setSubmittedThisMonth] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<FormSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user data from Firestore
        try {
          const userDoc = await getDocs(
            query(collection(db, "users"), where("uid", "==", user.uid))
          );

          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data() as UserData;
            setUser(userData);

            // Load dashboard data
            await loadDashboardData(userData);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
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
      // Get pending approvals count
      const pendingQuery = query(
        collection(db, "forms"),
        where("status", "==", "in_review"),
        where(`approvers.${userData.role}`, "==", userData.uid)
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      setPendingApprovals(pendingSnapshot.size);

      // Get draft count
      const draftQuery = query(
        collection(db, "forms"),
        where("requesterUid", "==", userData.uid),
        where("status", "==", "draft")
      );
      const draftSnapshot = await getDocs(draftQuery);
      setDraftCount(draftSnapshot.size);

      // Get submitted this month count
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const startOfMonth = new Date(currentYear, currentMonth, 1);

      const submittedQuery = query(
        collection(db, "forms"),
        where("requesterUid", "==", userData.uid),
        where("createdAt", ">=", startOfMonth),
        where("status", "in", ["submitted", "in_review", "approved", "rejected"])
      );
      const submittedSnapshot = await getDocs(submittedQuery);
      setSubmittedThisMonth(submittedSnapshot.size);

      // Get recent activity
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
    <div className="min-h-screen flex bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Ajukan Form
                </Link>
              </li>
              <li>
                <Link href="/approvals" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Inbox Persetujuan
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
                  Riwayat
                </Link>
              </li>
            </ul>
          </div>

          {["admin", "hrd", "manager", "general_manager"].includes(user?.role) && (
            <div className="mb-6">
              <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
                Administration
              </h2>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/admin/users"
                    className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"
                  >
                    <svg
                      className="w-5 h-5 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    Manajemen User
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-green-100">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-medium text-gray-900">Halo, {user?.nama}</p>
                <p className="text-sm text-gray-500 capitalize">{user?.role} • {user?.dept}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white py-2 px-4 rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
              <div className="flex items-center">
                <div className="rounded-lg bg-green-100 p-3 mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pending Approval</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingApprovals}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
              <div className="flex items-center">
                <div className="rounded-lg bg-blue-100 p-3 mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Draft Saya</p>
                  <p className="text-2xl font-bold text-gray-900">{draftCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
              <div className="flex items-center">
                <div className="rounded-lg bg-purple-100 p-3 mr-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Diajukan Bulan Ini</p>
                  <p className="text-2xl font-bold text-gray-900">{submittedThisMonth}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
              <div className="flex items-center">
                <div className="rounded-lg bg-yellow-100 p-3 mr-4">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Aktivitas Terbaru</p>
                  <p className="text-2xl font-bold text-gray-900">{recentActivity.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-green-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="flex flex-col items-center justify-center p-4 border border-green-200 rounded-lg hover:bg-green-50 transition">
                <div className="bg-green-100 p-2 rounded-lg mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500">Ajukan Cuti</span>
              </button>

              <button className="flex flex-col items-center justify-center p-4 border border-green-200 rounded-lg hover:bg-green-50 transition">
                <div className="bg-green-100 p-2 rounded-lg mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500">Ajukan Overtime</span>
              </button>

              <button className="flex flex-col items-center justify-center p-4 border border-green-200 rounded-lg hover:bg-green-50 transition">
                <div className="bg-green-100 p-2 rounded-lg mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500">Purchase Order</span>
              </button>

              <button className="flex flex-col items-center justify-center p-4 border border-green-200 rounded-lg hover:bg-green-50 transition">
                <div className="bg-green-100 p-2 rounded-lg mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500">Labor Request</span>
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Aktivitas Terbaru</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">Jenis Form</th>
                    <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">Tanggal</th>
                    <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => (
                      <tr key={activity.id} className="border-b border-gray-100 hover:bg-green-50">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{activity.type}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {activity.createdAt?.toDate?.().toLocaleDateString('id-ID')}
                        </td>
                        <td className="py-3 px-4">
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
                      <td colSpan={3} className="py-4 px-4 text-center text-sm text-gray-500">
                        Tidak ada aktivitas terbaru
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;