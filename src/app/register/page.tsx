"use client";

import React, { useState, useEffect } from "react";
import Card from "@/components/Card";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    // Fetch departments dari Firestore
    useEffect(() => {
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
    }, []);

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

        setIsLoading(true);

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
                dept: formData.dept, // ID dept dari dropdown
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
            setIsLoading(false);
        }


        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-xl font-bold mb-4">Register</h1>

                    {error && <p className="text-red-500 mb-2">{error}</p>}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            name="nik"
                            placeholder="NIK"
                            value={formData.nik}
                            onChange={handleChange}
                            className="w-full p-2 border rounded"
                        />
                        <input
                            name="nama"
                            placeholder="Nama"
                            value={formData.nama}
                            onChange={handleChange}
                            className="w-full p-2 border rounded"
                        />

                        {/* Dropdown Departemen */}
                        <select
                            name="dept"
                            value={formData.dept}
                            onChange={handleChange}
                            className="w-full p-2 border rounded"
                            required
                        >
                            <option value="">-- Pilih Departemen --</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>

                        <input
                            name="jabatan"
                            placeholder="Jabatan"
                            value={formData.jabatan}
                            onChange={handleChange}
                            className="w-full p-2 border rounded"
                        />

                        <select
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            className="w-full p-2 border rounded"
                            required
                        >
                            <option value="">-- Pilih Role --</option>
                            <option value="staff">Staff</option>
                            <option value="manager">Manager</option>
                            <option value="gm">General Manager</option>
                            <option value="hrd">HRD</option>
                            <option value="finance">Finance</option>
                            <option value="admin">Admin</option>
                        </select>

                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full p-2 border rounded"
                        />
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full p-2 border rounded"
                        />
                        <input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm Password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="w-full p-2 border rounded"
                        />

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                            {isLoading ? "Registering..." : "Register"}
                        </button>
                    </form>

                    <p className="mt-4 text-sm text-gray-600">
                        Sudah punya akun?{" "}
                        <Link href="/login" className="text-green-600 hover:underline">
                            Login
                        </Link>
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0] p-4">
            {/* CSS untuk mengatur placeholder dan input text */}
            <style jsx>{`
        /* Placeholder yang sedikit pudar */
        input::placeholder, select::placeholder {
          color: #9ca3af; /* Abu-abu medium */
          font-weight: 400;
        }
        
        /* Teks input yang lebih gelap/terang ketika diketik */
        input:not(:placeholder-shown), select:not([value=""]) {
          color: #1f2937; /* Hampir hitam */
          font-weight: 500;
        }
        
        /* Untuk browser tertentu */
        input:-ms-input-placeholder, select:-ms-input-placeholder {
          color: #9ca3af;
        }
        
        input::-ms-input-placeholder, select::-ms-input-placeholder {
          color: #9ca3af;
        }
        
        /* Style untuk option yang belum dipilih */
        select:invalid {
          color: #9ca3af;
        }
        
        /* Style untuk option yang sudah dipilih */
        select, select option {
          color: #1f2937;
        }
      `}</style>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-green-100">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-xl flex items-center justify-center shadow-md">
                                <span className="text-white font-bold text-2xl">POA</span>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Prestova One Approval</h1>
                        <p className="text-gray-600">Create your account</p>
                    </div>

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
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        name="nik"
                                        value={formData.nik}
                                        onChange={handleChange}
                                        placeholder="Enter your NIK"
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="Enter your email"
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Enter password"
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Confirm Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="Confirm password"
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block mb-1 text-sm font-medium text-gray-700">Nama Lengkap</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        name="nama"
                                        value={formData.nama}
                                        onChange={handleChange}
                                        placeholder="Enter your full name"
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                                <select
                                    name="dept"
                                    value={formData.dept}
                                    onChange={handleChange}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                    required
                                >
                                    <option value="">-- Pilih Departemen --</option>
                                    {departments.map((dept) => (
                                        <option key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Jabatan</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        name="jabatan"
                                        value={formData.jabatan}
                                        onChange={handleChange}
                                        placeholder="Your position"
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block mb-1 text-sm font-medium text-gray-700">Role</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition appearance-none"
                                        required
                                    >
                                        <option value="" className="text-gray-400">Select your role</option>
                                        <option value="admin">Admin</option>
                                        <option value="manager">Manager</option>
                                        <option value="general_manager">General Manager</option>
                                        <option value="staff">Staff</option>
                                        <option value="hrd">HRD</option>
                                        <option value="finance">Finance</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white py-3 px-4 rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg mt-4"
                        >
                            {isLoading ? (
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

                    <div className="mt-6 text-center">
                        <p className="text-gray-600 text-sm">
                            Already have an account?{" "}
                            <Link href="/" className="text-green-600 font-medium hover:text-green-500 transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;