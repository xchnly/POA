"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, collection, getDocs, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";

interface UserData {
  uid: string;
  nama: string;
  role: string;
  dept: string;
  jabatan: string;
}

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    nik: "",
    email: "",
    password: "",
    confirmPassword: "",
    nama: "",
    dept: "",
    jabatan: "",
    role: "",
  });

  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as UserData;
          setUserProfile(userData);

          const allowedRoles = ["hrd", "admin", "manager", "general_manager"];
          if (!allowedRoles.includes(userData.role)) {
            router.push("/dashboard");
          }

          // Fetch pending approvals for sidebar count
          if (userData.role !== "staff") {
            const pendingQuery = collection(db, "forms");
            const pendingSnapshot = await getDocs(pendingQuery);
            setPendingApprovals(
              pendingSnapshot.docs.filter(
                (doc) =>
                  doc.data().status === "in_review" &&
                  doc.data().approvers?.[userData.role] === userData.uid
              ).length
            );
          }
        }
      } catch (error) {
        console.error("Error fetching user data or pending approvals:", error);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    });

    // Fetch departments for the form dropdown
    const fetchDepartments = async () => {
      try {
        const snapshot = await getDocs(collection(db, "departments"));
        const deptList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDepartments(deptList);
      } catch (err) {
        console.error("Error fetching departments:", err);
      }
    };

    fetchDepartments();
    return () => unsubscribe();
  }, [router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password should be at least 6 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        nik: formData.nik,
        email: formData.email,
        nama: formData.nama,
        dept: formData.dept,
        jabatan: formData.jabatan,
        role: formData.role,
        createdAt: new Date(),
      });

      router.push("/dashboard");
    } catch (error: any) {
      console.error("Error registering user:", error);
      if (error.code === "auth/email-already-in-use") {
        setError("Email already registered. Please use a different email.");
      } else if (error.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
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
                <Link href="/dashboard" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
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

          {["admin", "hrd", "manager", "general_manager"].includes(userProfile?.role || '') && (
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
                  <Link href="/register" className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="w-5 h-5 mr-3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                    </svg>
                    Register
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
            <h1 className="text-2xl font-bold text-gray-900">User Registration</h1>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-medium text-gray-900">Hello, {userProfile?.nama}</p>
                <p className="text-sm text-gray-500 capitalize">{userProfile?.role}</p>
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

        {/* Registration Form */}
        <main className="p-6">
          <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-green-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Create New Account</h2>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">NIK</label>
                  <input type="text" name="nik" value={formData.nik} onChange={handleChange} placeholder="Enter NIK" className="w-full pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter email" className="w-full pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Password</label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter password" className="w-full pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Confirm Password</label>
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm password" className="w-full pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">Nama Lengkap</label>
                  <input type="text" name="nama" value={formData.nama} onChange={handleChange} placeholder="Enter full name" className="w-full pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Departemen</label>
                  <select name="dept" value={formData.dept} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required>
                    <option value="">-- Pilih Departemen --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Jabatan</label>
                  <input type="text" name="jabatan" value={formData.jabatan} onChange={handleChange} placeholder="Your position" className="w-full pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">Role</label>
                  <select name="role" value={formData.role} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required>
                    <option value="">-- Select Role --</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="general_manager">General Manager</option>
                    <option value="staff">Staff</option>
                    <option value="hrd">HRD</option>
                    <option value="finance">Finance</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white py-3 px-4 rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg mt-4">
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Account...
                  </div>
                ) : (
                  "Register"
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RegisterPage;