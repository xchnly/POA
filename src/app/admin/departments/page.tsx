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
  status?: string;
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load users and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("🔄 Starting data fetch from Firestore...");
        setDebugInfo("Fetching data...");
        
        // 1. Fetch all users from the "users" collection (WITHOUT ANY FILTER)
        const allUsersQuery = collection(db, "users");
        const allUsersSnap = await getDocs(allUsersQuery);
        const allUsersList: User[] = allUsersSnap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        } as User));
        
        console.log("👥 All users from Firestore:", allUsersList);
        setAllUsersDebug(allUsersList);
        
        // 2. Debug each user to see the role and position fields
        console.log("🔍 Detailed analysis of each user:");
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

        // 3. Filter users who can be managers (REMOVE STATUS FILTER)
        const managerUsers = allUsersList.filter(user => {
          // Skip users without a name (invalid data)
          if (!user.nama) {
            console.log("❌ User without a name, skipped:", user);
            return false;
          }
          
          // Check role and position
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
        
        console.log("🎯 Filtered manager users:", managerUsers);
        setUsers(managerUsers);
        setDebugInfo(`Total users: ${allUsersList.length}, Manager users: ${managerUsers.length}`);

        // 4. Fetch departments
        const deptSnap = await getDocs(collection(db, "departments"));
        const deptList: Department[] = [];
        
        for (const doc of deptSnap.docs) {
          const deptData = doc.data();
          console.log("🏢 Department data:", deptData);
          
          // Calculate employee count in this department
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
        // Remove manager from department
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
        
        alert("Manager successfully removed from the department.");
      } else if (manager) {
        // Assign new manager
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
        
        alert(`Manager ${manager.nama} successfully assigned to the department.`);
      }
    } catch (error) {
      console.error("❌ Error assigning manager:", error);
      alert("An error occurred while assigning the manager.");
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
        alert("A department with that name already exists.");
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
      alert("Department successfully added.");
    } catch (error) {
      console.error("❌ Error adding department:", error);
      alert("An error occurred while adding the department.");
    }
  };

  const handleDeleteDepartment = async (deptId: string, deptName: string) => {
    if (!confirm(`Are you sure you want to delete department ${deptName}?`)) {
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
        alert("Cannot delete a department that still has active employees.");
        return;
      }
      
      // Delete department from Firestore
      await deleteDoc(doc(db, "departments", deptId));
      
      // Update local state
      setDepartments(prev => prev.filter(dept => dept.id !== deptId));
      
      alert("Department successfully deleted.");
    } catch (error) {
      console.error("❌ Error deleting department:", error);
      alert("An error occurred while deleting the department.");
    }
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.managerName && dept.managerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
              <Link href="/admin/users" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                <span className="mr-3">👥</span>
                User & Employees
              </Link>
            </li>
            <li>
              <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                <span className="mr-3">🏢</span>
                Department
              </div>
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
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Management</h2>
            <ul className="space-y-1">
              <li>
                <Link href="/admin/users" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <span className="mr-3">👥</span>
                  User & Employees
                </Link>
              </li>
              <li>
                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                  <span className="mr-3">🏢</span>
                  Department
                </div>
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
              <h1 className="text-2xl font-bold text-gray-900">Department Management</h1>
              <p className="text-sm text-gray-500">Manage departments and assign managers for each department</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition"
            >
              + Add Department
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Enhanced Debug Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">🔍 Detailed Debug Information</h3>
            <p className="text-xs text-yellow-700">Total users from Firestore: {allUsersDebug.length}</p>
            <p className="text-xs text-yellow-700">Manager users that passed the filter: {users.length}</p>
            <p className="text-xs text-yellow-700">Number of Departments: {departments.length}</p>
            <p className="text-xs text-yellow-700">{debugInfo}</p>
            
            <details className="mt-2">
              <summary className="text-xs text-yellow-700 cursor-pointer font-medium">📋 View ALL Users from Firestore</summary>
              <div className="text-xs bg-yellow-100 p-2 mt-1 overflow-auto max-h-60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1">Name</th>
                      <th className="text-left p-1">Role</th>
                      <th className="text-left p-1">Position</th>
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
              <summary className="text-xs text-yellow-700 cursor-pointer font-medium">✅ Filtered Manager Users</summary>
              <pre className="text-xs bg-yellow-100 p-2 mt-1 overflow-auto max-h-40">
                {JSON.stringify(users, null, 2)}
              </pre>
            </details>
            
            <details className="mt-2">
              <summary className="text-xs text-yellow-700 cursor-pointer">View Department Details</summary>
              <pre className="text-xs bg-yellow-100 p-2 mt-1 overflow-auto max-h-40">
                {JSON.stringify(departments, null, 2)}
              </pre>
            </details>
          </div>

          {/* Filter and Search */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Department</label>
                <input
                  type="text"
                  placeholder="Search by department name or manager..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Departments</label>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-300">
                  <span className="text-lg font-bold text-green-600">{filteredDepartments.length}</span> departments
                </div>
              </div>
            </div>
          </div>

          {/* Add Department Form */}
          {showAddForm && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Department</h2>
              
              <form onSubmit={handleAddDepartment} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="Enter department name"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                  />
                </div>
                
                <div className="flex space-x-3 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewDeptName("");
                    }}
                    className="flex-1 md:flex-none px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 md:flex-none px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Department Table */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Department List</h2>
            
            {filteredDepartments.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-4 0H9m4 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v12m4 0V9" />
                </svg>
                <p className="text-gray-500">No department data found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Department Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Employee Count</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manager</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDepartments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {dept.employeeCount} people
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <select
                            value={dept.managerId || ""}
                            onChange={(e) => handleAssignManager(dept.id, e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                          >
                            <option value="">-- Select Manager --</option>
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
                            title={(dept.employeeCount ?? 0) > 0 ? "Cannot delete department that still has employees" : "Delete department"}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Information Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Important Information</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Users with a role or position containing 'manager' and 'general_manager' can be assigned as department heads</li>
                    <li>The filter now ignores user status - all users with a manager role will be displayed</li>
                    <li>Ensure the user's role or position is correct in the users collection</li>
                    <li>Departments cannot be deleted if they still have active employees</li>
                    <li>Assigning a department manager will affect the form approval flow</li>
                    <li>The 'dept' field for a user can contain either the department ID or the department name</li>
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