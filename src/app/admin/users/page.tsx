"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  doc, setDoc, getDocs, collection, deleteDoc, updateDoc,
  serverTimestamp, query, where, orderBy, writeBatch
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import * as XLSX from "xlsx";

interface Employee {
  id: string;
  nik: string;
  nama: string;
  dept: string;
  jabatan: string;
  email: string;
  telepon: string;
  role: string;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface Department {
  id: string;
  name: string;
}

const ManagementPage: React.FC = () => {
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentNames, setDepartmentNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [formData, setFormData] = useState({
    nik: "",
    nama: "",
    dept: "",
    jabatan: "",
    email: "",
    telepon: "",
    role: "staff",
    status: "active"
  });

  // Load employees and departments data
  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  // Filter employees based on search and department filter
  useEffect(() => {
    let filtered = employees;

    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.telepon.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (deptFilter) {
      filtered = filtered.filter(emp => emp.dept === deptFilter);
    }

    setFilteredEmployees(filtered);
  }, [employees, searchTerm, deptFilter]);

  const fetchEmployees = async () => {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "employees"), orderBy("nama"))
      );

      const employeesData: Employee[] = [];
      const deptSet = new Set<string>();

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Employee;
        employeesData.push({ ...data, id: doc.id });
        deptSet.add(data.dept);
      });

      setEmployees(employeesData);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "departments"));
      const departmentsData: Department[] = [];
      const deptNames: string[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        departmentsData.push({ id: doc.id, name: data.name });
        deptNames.push(data.name);
      });

      setDepartments(departmentsData);
      setDepartmentNames(deptNames.sort());
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.nik.trim()) {
      alert("NIK is required!");
      return false;
    }
    if (!formData.nama.trim()) {
      alert("Name is required!");
      return false;
    }
    if (!formData.dept.trim()) {
      alert("Department is required!");
      return false;
    }
    if (!formData.jabatan.trim()) {
      alert("Position is required!");
      return false;
    }
    if (!formData.email.trim()) {
      alert("Email is required!");
      return false;
    }
    if (!formData.telepon.trim()) {
      alert("Phone number is required!");
      return false;
    }

    // Validasi department harus sesuai dengan yang sudah ada
    if (!departmentNames.includes(formData.dept)) {
      alert(`Department "${formData.dept}" is not listed. Please choose an existing department.`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      if (editingEmployee) {
        // Update existing employee
        await updateDoc(doc(db, "employees", editingEmployee.id), {
          nik: formData.nik,
          nama: formData.nama,
          dept: formData.dept,
          jabatan: formData.jabatan,
          email: formData.email,
          telepon: formData.telepon,
          role: formData.role,
          status: formData.status,
          updatedAt: serverTimestamp()
        });
        alert("Employee data updated successfully!");
      } else {
        // Check if NIK already exists
        const nikQuery = query(collection(db, "employees"), where("nik", "==", formData.nik));
        const nikSnapshot = await getDocs(nikQuery);

        if (!nikSnapshot.empty) {
          alert("NIK is already registered! Please use a different NIK.");
          return;
        }

        // Check if email already exists
        const emailQuery = query(collection(db, "employees"), where("email", "==", formData.email));
        const emailSnapshot = await getDocs(emailQuery);

        if (!emailSnapshot.empty) {
          alert("Email is already registered! Please use a different email.");
          return;
        }

        // Create new employee
        const employeeId = `emp-${Date.now()}`;
        await setDoc(doc(db, "employees", employeeId), {
          nik: formData.nik,
          nama: formData.nama,
          dept: formData.dept,
          jabatan: formData.jabatan,
          email: formData.email,
          telepon: formData.telepon,
          role: formData.role,
          status: formData.status,
          id: employeeId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        alert("New employee added successfully!");
      }

      // Reset form and refresh data
      resetForm();
      fetchEmployees();

    } catch (error) {
      console.error("Error saving employee:", error);
      alert("An error occurred while saving employee data.");
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      nik: employee.nik,
      nama: employee.nama,
      dept: employee.dept,
      jabatan: employee.jabatan,
      email: employee.email,
      telepon: employee.telepon || "",
      role: employee.role,
      status: employee.status
    });
    setShowAddForm(true);
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete employee ${employee.nama}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "employees", employee.id));
      alert("Employee deleted successfully!");
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("An error occurred while deleting the employee.");
    }
  };

  const resetForm = () => {
    setFormData({
      nik: "",
      nama: "",
      dept: "",
      jabatan: "",
      email: "",
      telepon: "",
      role: "staff",
      status: "active"
    });
    setEditingEmployee(null);
    setShowAddForm(false);
    setShowUploadForm(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          alert("Empty Excel file or incorrect format!");
          return;
        }

        processExcelData(jsonData as Employee[]);
      } catch (error) {
        console.error("Error reading Excel file:", error);
        alert("An error occurred while reading the Excel file. Please ensure the file format is correct.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processExcelData = async (data: Employee[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    const batch = writeBatch(db);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Validate required fields
        if (!row.nik || !row.nama || !row.dept || !row.jabatan || !row.email) {
          errors.push(`Row ${i + 2}: Incomplete data`);
          errorCount++;
          continue;
        }

        // Validasi department harus sesuai dengan yang sudah ada
        if (!departmentNames.includes(row.dept.toString())) {
          errors.push(`Row ${i + 2}: Department "${row.dept}" is not listed`);
          errorCount++;
          continue;
        }

        // Check if NIK already exists
        const nikQuery = query(collection(db, "employees"), where("nik", "==", row.nik.toString()));
        const nikSnapshot = await getDocs(nikQuery);

        if (!nikSnapshot.empty) {
          errors.push(`Row ${i + 2}: NIK ${row.nik} is already registered`);
          errorCount++;
          continue;
        }

        // Check if email already exists
        const emailQuery = query(collection(db, "employees"), where("email", "==", row.email.toString()));
        const emailSnapshot = await getDocs(emailQuery);

        if (!emailSnapshot.empty) {
          errors.push(`Row ${i + 2}: Email ${row.email} is already registered`);
          errorCount++;
          continue;
        }

        // Create new employee document
        const employeeId = `emp-${Date.now()}-${i}`;
        const employeeRef = doc(db, "employees", employeeId);

        batch.set(employeeRef, {
          id: employeeId,
          nik: row.nik.toString(),
          nama: row.nama.toString(),
          dept: row.dept.toString(),
          jabatan: row.jabatan.toString(),
          email: row.email.toString(),
          telepon: row.telepon ? row.telepon.toString() : "",
          role: row.role?.toString() || "staff",
          status: row.status?.toString() || "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        successCount++;
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error}`);
        errorCount++;
      }

      // Update progress
      setUploadProgress(Math.round(((i + 1) / data.length) * 100));
    }

    try {
      if (successCount > 0) {
        await batch.commit();
      }

      let message = `Upload complete!\nSuccess: ${successCount}\nFailed: ${errorCount}`;
      if (errors.length > 0) {
        message += `\n\nError details:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n...and ${errors.length - 5} other errors`;
        }
      }

      alert(message);
      fetchEmployees();
    } catch (error) {
      alert("An error occurred while saving data: " + error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const downloadTemplate = () => {
    // Gunakan department yang sudah ada sebagai contoh
    const exampleDept = departmentNames.length > 0 ? departmentNames[0] : "IT";

    const templateData = [
      {
        nik: "12345",
        nama: "John Doe",
        dept: exampleDept,
        jabatan: "Developer",
        email: "john.doe@example.com",
        telepon: "08123456789",
        role: "staff",
        status: "active"
      }
    ];

    // Tambahkan sheet dengan daftar department yang valid
    const deptSheet = XLSX.utils.json_to_sheet(departmentNames.map(name => ({ department: name })));
    const dataSheet = XLSX.utils.json_to_sheet(templateData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Template");
    XLSX.utils.book_append_sheet(workbook, deptSheet, "Available Departments");

    XLSX.writeFile(workbook, "employee_template.xlsx");
  };

  const handleSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
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
              <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="mr-3 size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                User & Employee
              </div>
            </li>
            <li>
              <Link href="/admin/departments" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="mr-3 size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
                </svg>
                Department
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
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Management</h2>
            <ul className="space-y-1">
              <li>
                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="mr-3 size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                  </svg>
                  User & Employees
                </div>
              </li>
              <li>
                <Link href="/admin/departments" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="mr-3 size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
                  </svg>
                  Department
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
              <h1 className="text-2xl font-bold text-gray-900">User & Employee Management</h1>
              <p className="text-sm text-gray-500">Manage POA system user and employee data</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowUploadForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition flex items-center gap-2"
              >
                <i className="ri-file-upload-line"></i>
                <span className="hidden sm:inline">Upload Excel</span>
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition flex items-center gap-2"
              >
                <i className="ri-user-add-line"></i>
                <span className="hidden sm:inline">Add Employee</span>
              </button>

            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Filter dan Pencarian */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Employee</label>
                <input
                  type="text"
                  placeholder="Search by name, NIK, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Department</label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                >
                  <option value="">All Departments</option>
                  {departmentNames.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Employees</label>
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-300">
                  <span className="text-lg font-bold text-green-600">{filteredEmployees.length}</span> People
                </div>
              </div>
            </div>
          </div>

          {/* Form Upload Excel */}
          {showUploadForm && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Employee Data from Excel</h2>

              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">搭 Excel File Format:</h3>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li>Required columns: nik, nama, dept, jabatan, email</li>
                  <li>Optional columns: telepon, role, status</li>
                  <li>Default role: staff | Default status: active</li>
                  <li>File format: .xlsx or .xls</li>
                  <li>Department must match an existing department</li>
                </ul>
                {departmentNames.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-blue-700 font-medium">Available Departments:</p>
                    <p className="text-sm text-blue-600">{departmentNames.join(", ")}</p>
                  </div>
                )}
                <button
                  onClick={downloadTemplate}
                  className="mt-3 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition"
                >
                  踏 Download Template
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600">
                    Click to upload an Excel file
                  </p>
                  <p className="text-xs text-gray-500 mt-1">.xlsx or .xls format (max. 5MB)</p>
                </label>
              </div>

              {isUploading && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Upload Progress</span>
                    <span className="text-sm font-medium text-gray-700">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Form Tambah/Edit Karyawan */}
          {showAddForm && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {editingEmployee ? "Edit Employee Data" : "Add New Employee"}
              </h2>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIK *</label>
                  <input
                    type="text"
                    name="nik"
                    value={formData.nik}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                    disabled={!!editingEmployee}
                    placeholder="Employee ID Number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="nama"
                    value={formData.nama}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                    placeholder="Employee full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <select
                    name="dept"
                    value={formData.dept}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                  >
                    <option value="">Select Department</option>
                    {departmentNames.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Must match an existing department</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position *</label>
                  <input
                    type="text"
                    name="jabatan"
                    value={formData.jabatan}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                    placeholder="Position/title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                    placeholder="email@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    name="telepon"
                    value={formData.telepon}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                    placeholder="08123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="hrd">HRD</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="md:col-span-2 flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition"
                  >
                    {editingEmployee ? "Update" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabel Karyawan */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Employee List</h2>

            {filteredEmployees.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-gray-500">No employee data found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">NIK</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Position</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Phone</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{employee.nik}</td>
                        <td className="px-4 py-3 text-sm">{employee.nama}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{employee.dept}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{employee.jabatan}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{employee.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{employee.telepon || "-"}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${employee.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            employee.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                              employee.role === 'hrd' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                            }`}>
                            {employee.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {employee.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(employee)}
                              className="text-green-600 hover:text-green-800"
                              title="Edit"
                            >
                              <i className="ri-pencil-fill text-green-600"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(employee)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ManagementPage;