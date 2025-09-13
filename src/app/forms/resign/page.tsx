"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import Swal from 'sweetalert2';

// --- Interfaces ---
interface UserData {
    uid: string;
    email: string | null;
    nama?: string;
    nik?: string;
    dept?: string;
    deptId?: string;
    jabatan?: string;
    role?: string;
}

interface Employee {
    id: string;
    nik: string;
    nama: string;
    dept?: string;
    jabatan: string;
    uid?: string;
}

interface Department {
    id: string;
    name: string;
}

// --- Page Component ---
// Type guard to check if object is Employee
function isEmployee(obj: UserData | Employee): obj is Employee {
    return (obj as Employee).id !== undefined;
}

const ResignRequestPage: React.FC = () => {
    const router = useRouter();
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [requestType, setRequestType] = useState<"self" | "team">("self");
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>("");
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Form data state
    const [formData, setFormData] = useState({
        resignationDate: "",
        reason: "",
        employeeId: "",
    });

    const [userDeptName, setUserDeptName] = useState<string>("");

    // --- Side effect to fetch user & department data ---
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!authUser) {
                router.push("/");
                return;
            }
            try {
                // Fetch user profile from users
                const userDocRef = doc(db, "users", authUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data() as UserData;
                    setUserProfile(userData);

                    // Get department ID - try 'dept' first, then 'deptId'
                    const userDeptId = userData.dept || userData.deptId;

                    // Fetch user's department name
                    if (userDeptId) {
                        const deptDocRef = doc(db, "departments", userDeptId);
                        const deptDocSnap = await getDoc(deptDocRef);
                        if (deptDocSnap.exists()) {
                            setUserDeptName(deptDocSnap.data().name);
                        }
                    }
                } else {
                    router.push("/");
                    return;
                }

                // Fetch all departments
                const deptSnapshot = await getDocs(collection(db, "departments"));
                const deptList: Department[] = [];
                deptSnapshot.forEach(doc => {
                    deptList.push({ id: doc.id, name: doc.data().name });
                });
                setDepartments(deptList);
            } catch (error) {
                console.error("Error fetching initial data:", error);
                await Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to load data. Please try again.'
                });
            }
        };

        fetchInitialData();
    }, [authUser, router]);

    // --- Side effect to fetch employees from employees collection when a department is selected ---
    useEffect(() => {
        const fetchEmployees = async () => {
            if (selectedDeptId) {
                try {
                    // Get the department name based on the selected ID
                    const selectedDept = departments.find(dept => dept.id === selectedDeptId);
                    if (!selectedDept) {
                        setEmployees([]);
                        return;
                    }

                    console.log("Fetching employees for department:", selectedDept.name);

                    // Query using the 'dept' field in the employees collection
                    const employeesQuery = query(
                        collection(db, "employees"),
                        where("dept", "==", selectedDept.name)
                    );

                    const employeesSnapshot = await getDocs(employeesQuery);
                    const employeeList: Employee[] = [];

                    employeesSnapshot.forEach(docSnap => {
                        const employeeData = docSnap.data() as Employee;
                        const { id, ...restEmployeeData } = employeeData;
                        employeeList.push({
                            id: docSnap.id,
                            ...restEmployeeData
                        });
                    });

                    console.log("Employees found:", employeeList.length);
                    setEmployees(employeeList);

                } catch (error) {
                    console.error("Error fetching employees:", error);
                    setEmployees([]);
                }
            } else {
                setEmployees([]);
            }
        };

        fetchEmployees();
    }, [selectedDeptId, departments]);

    // --- Form Logic ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { value } = e.target;
        setSelectedDeptId(value);
        setFormData(prev => ({ ...prev, employeeId: "" })); // Reset employee dropdown
    };

    const handleRequestTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRequestType(e.target.value as "self" | "team");
        setSelectedDeptId("");
        setFormData(prev => ({ ...prev, employeeId: "" }));
    };

    // --- Main Submit Function ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'User profile not loaded. Please try again.'
            });
            return;
        }

        if (!formData.resignationDate || !formData.reason) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please complete all required fields.'
            });
            return;
        }

        if (requestType === "team" && (!selectedDeptId || !formData.employeeId)) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please select a department and a team member for the resignation request.'
            });
            return;
        }

        const confirmationResult = await Swal.fire({
            title: 'Submit Resignation?',
            text: 'You are about to submit this form. Make sure all data is correct.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Submit!',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33',
        });

        if (!confirmationResult.isConfirmed) {
            return;
        }

        setIsSubmitting(true);

        try {
            const formId = `resign-${Date.now()}`;

            let employeeToResign: Employee | UserData = userProfile;

            // Get the deptId from userProfile - try from possible fields
            const userDeptId = userProfile.deptId || userProfile.dept || "";

            // Get the department name
            let finalDeptName = userDeptName;
            if (!finalDeptName && userDeptId) {
                // If userDeptName is not set, find it from the departments array
                const userDepartment = departments.find(dept => dept.id === userDeptId);
                if (userDepartment) {
                    finalDeptName = userDepartment.name;
                }
            }

            if (requestType === "team") {
                const selectedEmployee = employees.find(emp => emp.id === formData.employeeId);
                if (!selectedEmployee) {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Employee not found.'
                    });
                    setIsSubmitting(false);
                    return;
                }
                employeeToResign = selectedEmployee;
            }

            // Ensure all fields have values, if undefined use an empty string
            const resignData = {
                employeeUid: employeeToResign.uid || (isEmployee(employeeToResign) ? employeeToResign.id : "") || "",
                type: "resign",
                jenisPengajuan: "Resign",
                requesterUid: userProfile.uid || "",
                requesterName: userProfile.nama || "",
                employeeName: employeeToResign.nama || "",
                employeeNik: employeeToResign.nik || "",
                deptId: userDeptId,
                dept: finalDeptName || "",
                resignationDate: formData.resignationDate,
                reason: formData.reason,
                status: "pending",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // Log data for debugging
            console.log("Submitting resign data:", resignData);

            await setDoc(doc(db, "forms", formId), resignData);

            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Resignation form submitted successfully!',
                timer: 2000,
                showConfirmButton: false
            });
            router.push("/dashboard");

        } catch (error) {
            console.error("Error submitting form:", error);
            await Swal.fire({
                icon: 'error',
                title: 'An Error Occurred',
                text: 'An error occurred while saving the form. Please try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!userProfile) {
        return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">Loading user data...</div>;
    }

    const isManager = userProfile.role === "manager";

    // --- JSX Structure (Form Page) ---
    return (
        <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
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
                        <Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition mb-4">
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Forms List
                        </Link>
                    </div>
                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Resignation Form</h2>
                        <ul className="space-y-1">
                            <li>
                                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                    <span className="mr-3">📝</span>
                                    Fill Form
                                </div>
                            </li>
                        </ul>
                    </div>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-green-100 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="lg:hidden p-2 mr-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Resignation Form</h1>
                                <p className="text-xs md:text-sm text-gray-500">Submit a resignation for yourself or a team member</p>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                            >
                                {isSubmitting ? "Submitting..." : "Submit Now"}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="p-4 md:p-6">
                    <div className="grid grid-cols-1 gap-6">
                        {/* Form Column */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-green-100">
                                <form onSubmit={handleSubmit} className="space-y-6">

                                    {/* Submission Type */}
                                    
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Submission Type</h3>
                                            <div className="flex space-x-4">
                                                <div className="flex items-center">
                                                    <input
                                                        id="self"
                                                        name="requestType"
                                                        type="radio"
                                                        value="self"
                                                        checked={requestType === "self"}
                                                        onChange={handleRequestTypeChange}
                                                        className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                                                    />
                                                    <label htmlFor="self" className="ml-2 block text-sm font-medium text-gray-700">For Myself</label>
                                                </div>
                                                <div className="flex items-center">
                                                    <input
                                                        id="team"
                                                        name="requestType"
                                                        type="radio"
                                                        value="team"
                                                        checked={requestType === "team"}
                                                        onChange={handleRequestTypeChange}
                                                        className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                                                    />
                                                    <label htmlFor="team" className="ml-2 block text-sm font-medium text-gray-700">For a Team Member</label>
                                                </div>
                                            </div>
                                        </div>
                                    

                                    {/* Requester Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Requester Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Name</p>
                                                <p className="mt-1 text-sm text-gray-900">{userProfile.nama}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">NIK</p>
                                                <p className="mt-1 text-sm text-gray-900">{userProfile.nik}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Department</p>
                                                <p className="mt-1 text-sm text-gray-900">{userDeptName || "Loading..."}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Team Member Selection */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Team Member</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                                    <select
                                                        id="departmentId"
                                                        name="departmentId"
                                                        value={selectedDeptId}
                                                        onChange={handleDeptChange}
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                        required
                                                    >
                                                        <option value="">Select Department</option>
                                                        {departments.map(dept => (
                                                            <option key={dept.id} value={dept.id}>
                                                                {dept.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">Team Member</label>
                                                    <select
                                                        id="employeeId"
                                                        name="employeeId"
                                                        value={formData.employeeId}
                                                        onChange={handleInputChange}
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                        disabled={!selectedDeptId || employees.length === 0}
                                                        required
                                                    >
                                                        <option value="">Select Team Member</option>
                                                        {employees.map(employee => (
                                                            <option key={employee.id} value={employee.id}>
                                                                {employee.nama} ({employee.nik})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {selectedDeptId && employees.length === 0 && (
                                                        <p className="text-sm text-red-500 mt-1">No employees found in this department</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    

                                    {/* Resignation Details */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Resignation Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="resignationDate" className="block text-sm font-medium text-gray-700 mb-1">Effective Resignation Date</label>
                                                <input
                                                    type="date"
                                                    id="resignationDate"
                                                    name="resignationDate"
                                                    value={formData.resignationDate}
                                                    onChange={handleInputChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Reason for Resignation</label>
                                            <textarea
                                                id="reason"
                                                name="reason"
                                                value={formData.reason}
                                                onChange={handleInputChange}
                                                rows={4}
                                                placeholder="Explain the reason for resignation..."
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                required
                                            />
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Information Section */}
                        <div className="">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-yellow-800">Important Information</h3>
                                        <div className="mt-2 text-sm text-yellow-700">
                                            <ul className="list-disc list-inside space-y-1">
                                                <li>This form is used to submit a resignation for yourself or a team member.</li>
                                                <li>Resignation requests require a **1-month notice period** before the effective date.</li>
                                                <li>Once submitted, this form will be forwarded for the approval process.</li>
                                                <li>Ensure the effective date and reason provided are correct.</li>
                                                <li>Team member data is retrieved from the **employees** collection.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons at the bottom */}
                    <div className="flex justify-end space-x-4 pt-6 mt-6 border-t border-gray-200">
                        <Link
                            href="/forms"
                            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                        >
                            {isSubmitting ? "Submitting..." : "Submit Resignation"}
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ResignRequestPage;