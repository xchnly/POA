"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

interface User {
  id: string;
  nik: string;
  nama: string;
  role: string;
  dept: string;
  email: string;
  status?: string; // Made optional since it might not exist
  jabatan?: string;
}

interface Department {
  id: string;
  name: string;
  managerId?: string;
  managerName?: string;
  managerNIK?: string;
  employeeCount?: number;
}

const DepartmentsPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [allUsersDebug, setAllUsersDebug] = useState<User[]>([]);

  // Load users dan departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("🔄 Memulai fetch data dari Firestore...");
        setDebugInfo("Sedang mengambil data...");
        
        // 1. Fetch semua users dari koleksi "users" (TANPA FILTER APAPUN)
        const allUsersQuery = collection(db, "users");
        const allUsersSnap = await getDocs(allUsersQuery);
        const allUsersList: User[] = allUsersSnap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        } as User));
        
        console.log("👥 Semua user dari Firestore:", allUsersList);
        setAllUsersDebug(allUsersList);
        
        // 2. Debug setiap user untuk melihat field role dan jabatan
        console.log("🔍 Detail analisis setiap user:");
        allUsersList.forEach(user => {
          console.log(`User: ${user.nama}`, {
            id: user.id,
            role: user.role,
            jabatan: user.jabatan,
            status: user.status,
            dept: user.dept,
            email: user.email
          });
        });

        // 3. Filter users yang bisa jadi manager (HAPUS FILTER STATUS)
        const managerUsers = allUsersList.filter(user => {
          // Skip users tanpa nama (data tidak valid)
          if (!user.nama) {
            console.log("❌ User tanpa nama, dilewati:", user);
            return false;
          }
          
          // Cek role dan jabatan
          const userRole = user.role ? user.role.toLowerCase().trim() : "";
          const userJabatan = user.jabatan ? user.jabatan.toLowerCase().trim() : "";
          
          const isManager = (
            userRole.includes("manager") ||
            userRole.includes("gm") ||
            userRole.includes("head") ||
            userRole === "general_manager" ||
            userRole === "general manager" ||
            userJabatan.includes("manager") ||
            userJabatan.includes("gm") ||
            userJabatan.includes("head") ||
            userJabatan.includes("kepala") ||
            userJabatan.includes("supervisor") ||
            userJabatan.includes("spv")
          );
          
          console.log(`✅ ${user.nama}: role="${userRole}", jabatan="${userJabatan}", isManager=${isManager}, status="${user.status || 'undefined'}"`);
          
          return isManager;
        });
        
        console.log("🎯 Manager users yang berhasil difilter:", managerUsers);
        setUsers(managerUsers);
        setDebugInfo(`Total user: ${allUsersList.length}, Manager users: ${managerUsers.length}`);

        // 4. Fetch departments
        const deptSnap = await getDocs(collection(db, "departments"));
        const deptList: Department[] = [];
        
        for (const doc of deptSnap.docs) {
          const deptData = doc.data();
          console.log("🏢 Department data:", deptData);
          
          // Hitung jumlah karyawan di department ini
          const employeesQuery = query(collection(db, "users"));
          const employeesSnap = await getDocs(employeesQuery);
          const employeesInDept = employeesSnap.docs.filter(empDoc => {
            const empData = empDoc.data();
            return empData.dept === doc.id || empData.dept === deptData.name;
          });
          
          deptList.push({
            id: doc.id,
            ...deptData,
            employeeCount: employeesInDept.length
          } as Department);
        }
        
        console.log("🏢 Departments list:", deptList);
        setDepartments(deptList);
        setLoading(false);
        
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        setDebugInfo(`Error: ${typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : String(error)}`);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAssignManager = async (deptId: string, managerId: string) => {
    try {
      console.log("🔧 Assigning manager:", { deptId, managerId });
      
      const manager = users.find((u) => u.id === managerId);
      
      if (managerId === "") {
        // Hapus manager dari department
        await updateDoc(doc(db, "departments", deptId), {
          managerId: "",
          managerName: "",
          managerNIK: ""
        });
        
        setDepartments(prev =>
          prev.map(d =>
            d.id === deptId
              ? { ...d, managerId: "", managerName: "", managerNIK: "" }
              : d
          )
        );
        
        alert("Manager berhasil dihapus dari departemen.");
      } else if (manager) {
        // Assign manager baru
        await updateDoc(doc(db, "departments", deptId), {
          managerId: manager.id,
          managerName: manager.nama,
          managerNIK: manager.nik
        });
        
        setDepartments(prev =>
          prev.map(d =>
            d.id === deptId
              ? {
                  ...d,
                  managerId: manager.id,
                  managerName: manager.nama,
                  managerNIK: manager.nik
                }
              : d
          )
        );
        
        alert(`Manager ${manager.nama} berhasil ditugaskan ke departemen.`);
      }
    } catch (error) {
      console.error("❌ Error assigning manager:", error);
      alert("Terjadi kesalahan saat menetapkan manager.");
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check if department already exists
      const existingDept = departments.find(
        dept => dept.name.toLowerCase() === newDeptName.toLowerCase()
      );
      
      if (existingDept) {
        alert("Departemen dengan nama tersebut sudah ada.");
        return;
      }
      
      // Add new department to Firestore
      const newDeptRef = doc(collection(db, "departments"));
      await setDoc(newDeptRef, {
        name: newDeptName,
        managerId: "",
        managerName: "",
        managerNIK: "",
        createdAt: new Date()
      });
      
      // Update local state
      setDepartments(prev => [
        ...prev,
        {
          id: newDeptRef.id,
          name: newDeptName,
          managerId: "",
          managerName: "",
          managerNIK: "",
          employeeCount: 0
        }
      ]);
      
      setNewDeptName("");
      setShowAddForm(false);
      alert("Departemen berhasil ditambahkan.");
    } catch (error) {
      console.error("❌ Error adding department:", error);
      alert("Terjadi kesalahan saat menambahkan departemen.");
    }
  };

  const handleDeleteDepartment = async (deptId: string, deptName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus departemen ${deptName}?`)) {
      return;
    }
    
    try {
      // Check if department has any employees
      const employeesQuery = query(collection(db, "users"));
      const employeesSnap = await getDocs(employeesQuery);
      const employeesInDept = employeesSnap.docs.filter(empDoc => {
        const empData = empDoc.data();
        return empData.dept === deptId || empData.dept === deptName;
      });
      
      if (employeesInDept.length > 0) {
        alert("Tidak dapat menghapus departemen yang masih memiliki karyawan aktif.");
        return;
      }
      
      // Delete department from Firestore
      await deleteDoc(doc(db, "departments", deptId));
      
      // Update local state
      setDepartments(prev => prev.filter(dept => dept.id !== deptId));
      
      alert("Departemen berhasil dihapus.");
    } catch (error) {
      console.error("❌ Error deleting department:", error);
      alert("Terjadi kesalahan saat menghapus departemen.");
    }
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.managerName && dept.managerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
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
          <div className="mb-2">
            <Link href="/dashboard" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition mb-4">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke Dashboard
            </Link>
          </div>
          
          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Manajemen</h2>
            <ul className="space-y-1">
              <li>
                <Link href="/admin/users" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <span className="mr-3">👥</span>
                  User & Karyawan
                </Link>
              </li>
              <li>
                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                  <span className="mr-3">🏢</span>
                  Department
                </div>
              </li>
              <li>
                <Link href="/admin/roles" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <span className="mr-3">🔒</span>
                  Role Management
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manajemen Departemen</h1>
              <p className="text-sm text-gray-500">Kelola departemen dan tentukan manager untuk setiap departemen</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition"
            >
              + Tambah Departemen
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Enhanced Debug Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">🔍 Informasi Debug Lengkap</h3>
            <p className="text-xs text-yellow-700">Total user dari Firestore: {allUsersDebug.length}</p>
            <p className="text-xs text-yellow-700">Manager users yang lolos filter: {users.length}</p>
            <p className="text-xs text-yellow-700">Jumlah Departments: {departments.length}</p>
            <p className="text-xs text-yellow-700">{debugInfo}</p>
            
            <details className="mt-2">
              <summary className="text-xs text-yellow-700 cursor-pointer font-medium">📋 Lihat SEMUA User dari Firestore</summary>
              <div className="text-xs bg-yellow-100 p-2 mt-1 overflow-auto max-h-60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1">Nama</th>
                      <th className="text-left p-1">Role</th>
                      <th className="text-left p-1">Jabatan</th>
                      <th className="text-left p-1">Status</th>
                      <th className="text-left p-1">Dept</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsersDebug.map(user => (
                      <tr key={user.id} className="border-b">
                        <td className="p-1">{user.nama || 'N/A'}</td>
                        <td className="p-1">{user.role || 'N/A'}</td>
                        <td className="p-1">{user.jabatan || 'N/A'}</td>
                        <td className="p-1">{user.status || 'N/A'}</td>
                        <td className="p-1">{user.dept || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            
            <details className="mt-2">
              <summary className="text-xs text-yellow-700 cursor-pointer font-medium">✅ Manager Users (Yang Lolos Filter)</summary>
              <pre className="text-xs bg-yellow-100 p-2 mt-1 overflow-auto max-h-40">
                {JSON.stringify(users, null, 2)}
              </pre>
            </details>
            
            <details className="mt-2">
              <summary className="text-xs text-yellow-700 cursor-pointer">Lihat Detail Departments</summary>
              <pre className="text-xs bg-yellow-100 p-2 mt-1 overflow-auto max-h-40">
                {JSON.stringify(departments, null, 2)}
              </pre>
            </details>
          </div>

          {/* Filter dan Pencarian */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cari Departemen</label>
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama departemen atau manager..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Departemen</label>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-300">
                  <span className="text-lg font-bold text-green-600">{filteredDepartments.length}</span> departemen
                </div>
              </div>
            </div>
          </div>

          {/* Form Tambah Departemen */}
          {showAddForm && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Tambah Departemen Baru</h2>
              
              <form onSubmit={handleAddDepartment} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Departemen</label>
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="Masukkan nama departemen"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewDeptName("");
                    }}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabel Departemen */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Daftar Departemen</h2>
            
            {filteredDepartments.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-4 0H9m4 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v12m4 0V9" />
                </svg>
                <p className="text-gray-500">Tidak ada data departemen yang ditemukan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nama Departemen</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Jumlah Karyawan</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manager</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDepartments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {dept.employeeCount} orang
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <select
                            value={dept.managerId || ""}
                            onChange={(e) => handleAssignManager(dept.id, e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                          >
                            <option value="">-- Pilih Manager --</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.nama} ({user.nik}) - {user.role} {user.jabatan && `- ${user.jabatan}`}
                              </option>
                            ))}
                          </select>
                          {dept.managerName && (
                            <p className="text-xs text-gray-500 mt-1">
                              Current: {dept.managerName} ({dept.managerNIK})
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                            disabled={(dept.employeeCount ?? 0) > 0}
                            className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                            title={(dept.employeeCount ?? 0) > 0 ? "Tidak dapat menghapus departemen yang masih memiliki karyawan" : "Hapus departemen"}
                          >
                            🗑️ Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Informasi Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Informasi Penting</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>User dengan role atau jabatan yang mengandung manager dan general_manager dapat ditugaskan sebagai kepala departemen</li>
                    <li>Filter sekarang mengabaikan status user - semua user dengan role manager akan ditampilkan</li>
                    <li>Pastikan role atau jabatan user sudah sesuai di koleksi users</li>
                    <li>Departemen tidak dapat dihapus jika masih memiliki karyawan aktif</li>
                    <li>Penunjukkan manager departemen akan mempengaruhi alur approval form</li>
                    <li>Field dept pada user bisa berisi ID department atau nama department</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DepartmentsPage;