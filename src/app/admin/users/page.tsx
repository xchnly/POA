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
  createdAt: any;
  updatedAt: any;
}

const ManagementPage: React.FC = () => {
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load employees data
  useEffect(() => {
    fetchEmployees();
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
      setDepartments(Array.from(deptSet).sort());
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.nik.trim()) {
      alert("NIK harus diisi!");
      return false;
    }
    if (!formData.nama.trim()) {
      alert("Nama harus diisi!");
      return false;
    }
    if (!formData.dept.trim()) {
      alert("Department harus diisi!");
      return false;
    }
    if (!formData.jabatan.trim()) {
      alert("Jabatan harus diisi!");
      return false;
    }
    if (!formData.email.trim()) {
      alert("Email harus diisi!");
      return false;
    }
    if (!formData.telepon.trim()) {
      alert("Nomor telepon harus diisi!");
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
        alert("Data karyawan berhasil diupdate!");
      } else {
        // Check if NIK already exists
        const nikQuery = query(collection(db, "employees"), where("nik", "==", formData.nik));
        const nikSnapshot = await getDocs(nikQuery);
        
        if (!nikSnapshot.empty) {
          alert("NIK sudah terdaftar! Gunakan NIK yang berbeda.");
          return;
        }
        
        // Check if email already exists
        const emailQuery = query(collection(db, "employees"), where("email", "==", formData.email));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
          alert("Email sudah terdaftar! Gunakan email yang berbeda.");
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
        
        alert("Karyawan baru berhasil ditambahkan!");
      }
      
      // Reset form and refresh data
      resetForm();
      fetchEmployees();
      
    } catch (error) {
      console.error("Error saving employee:", error);
      alert("Terjadi kesalahan saat menyimpan data karyawan.");
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
    if (!confirm(`Apakah Anda yakin ingin menghapus karyawan ${employee.nama}?`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, "employees", employee.id));
      alert("Karyawan berhasil dihapus!");
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("Terjadi kesalahan saat menghapus karyawan.");
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
          alert("File Excel kosong atau format tidak sesuai!");
          return;
        }

        processExcelData(jsonData);
      } catch (error) {
        console.error("Error reading Excel file:", error);
        alert("Terjadi kesalahan saat membaca file Excel. Pastikan format file benar.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processExcelData = async (data: any[]) => {
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
          errors.push(`Baris ${i + 2}: Data tidak lengkap`);
          errorCount++;
          continue;
        }

        // Check if NIK already exists
        const nikQuery = query(collection(db, "employees"), where("nik", "==", row.nik));
        const nikSnapshot = await getDocs(nikQuery);
        
        if (!nikSnapshot.empty) {
          errors.push(`Baris ${i + 2}: NIK ${row.nik} sudah terdaftar`);
          errorCount++;
          continue;
        }

        // Check if email already exists
        const emailQuery = query(collection(db, "employees"), where("email", "==", row.email));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
          errors.push(`Baris ${i + 2}: Email ${row.email} sudah terdaftar`);
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
        errors.push(`Baris ${i + 2}: ${error}`);
        errorCount++;
      }

      // Update progress
      setUploadProgress(Math.round(((i + 1) / data.length) * 100));
    }

    try {
      if (successCount > 0) {
        await batch.commit();
      }
      
      let message = `Upload selesai!\nBerhasil: ${successCount}\nGagal: ${errorCount}`;
      if (errors.length > 0) {
        message += `\n\nError detail:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n...dan ${errors.length - 5} error lainnya`;
        }
      }
      
      alert(message);
      fetchEmployees();
    } catch (error) {
      alert("Terjadi kesalahan saat menyimpan data: " + error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        nik: "12345",
        nama: "John Doe",
        dept: "IT",
        jabatan: "Developer",
        email: "john.doe@example.com",
        telepon: "08123456789",
        role: "staff",
        status: "active"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "template_karyawan.xlsx");
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
                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                  <span className="mr-3">👥</span>
                  User & Karyawan
                </div>
              </li>
              <li>
                <Link href="/admin/departments" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <span className="mr-3">🏢</span>
                  Department
                </Link>
              </li>
              <li>
                <Link href="/admin/roles" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                  <span className="mr-3">🔐</span>
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
              <h1 className="text-2xl font-bold text-gray-900">Manajemen User & Karyawan</h1>
              <p className="text-sm text-gray-500">Kelola data user dan karyawan sistem POA</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowUploadForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition"
              >
                <i className="ri-file-upload-line"></i> Upload Excel
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition"
              >
                + Tambah Karyawan
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Cari Karyawan</label>
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, NIK, email, atau telepon..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter Department</label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                >
                  <option value="">Semua Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Karyawan</label>
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-300">
                  <span className="text-lg font-bold text-green-600">{filteredEmployees.length}</span> Orang
                </div>
              </div>
            </div>
          </div>

          {/* Form Upload Excel */}
          {showUploadForm && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Data Karyawan dari Excel</h2>
              
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">📋 Format File Excel:</h3>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li>Kolom wajib: nik, nama, dept, jabatan, email</li>
                  <li>Kolom opsional: telepon, role, status</li>
                  <li>Role default: staff | Status default: active</li>
                  <li>Format file: .xlsx atau .xls</li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition"
                >
                  📥 Download Template
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
                    Klik untuk upload file Excel
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Format .xlsx atau .xls (maks. 5MB)</p>
                </label>
              </div>

              {isUploading && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress Upload</span>
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
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Form Tambah/Edit Karyawan */}
          {showAddForm && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {editingEmployee ? "Edit Data Karyawan" : "Tambah Karyawan Baru"}
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
                    placeholder="Nomor Induk Karyawan"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    name="nama"
                    value={formData.nama}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                    placeholder="Nama lengkap karyawan"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <input
                    type="text"
                    name="dept"
                    value={formData.dept}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                    placeholder="Nama department"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jabatan *</label>
                  <input
                    type="text"
                    name="jabatan"
                    value={formData.jabatan}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    required
                    placeholder="Posisi/jabatan"
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
                    placeholder="email@perusahaan.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Telepon *</label>
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
                    <option value="active">Aktif</option>
                    <option value="inactive">Non-Aktif</option>
                  </select>
                </div>
                
                <div className="md:col-span-2 flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition"
                  >
                    {editingEmployee ? "Update" : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabel Karyawan */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Daftar Karyawan</h2>
            
            {filteredEmployees.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-gray-500">Tidak ada data karyawan yang ditemukan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">NIK</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nama</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Jabatan</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Telepon</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Aksi</th>
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
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            employee.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            employee.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                            employee.role === 'hrd' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {employee.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {employee.status === 'active' ? 'Aktif' : 'Non-Aktif'}
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
                              title="Hapus"
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