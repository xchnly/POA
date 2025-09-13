import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

const APP_NAME = 'PrestovaPOA';

interface ApprovalStep {
    role: string;
    uid: string;
    nama: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedAt: any;
    comments: string;
}

// Fungsi untuk mengirim email permintaan persetujuan
async function sendApprovalRequestEmail(formData: any) {
    // Ambil langkah persetujuan pertama yang berstatus 'pending'
    const pendingStep = formData.approvalFlow.find((step: ApprovalStep) => step.status === 'pending');

    if (!pendingStep) {
        console.error("No pending approval step found.");
        return;
    }

    // Ambil data user dari UID manajer yang bersangkutan
    const approverDoc = await getDoc(doc(db, 'users', pendingStep.uid));
    const approverData = approverDoc.exists() ? approverDoc.data() : null;

    if (!approverData?.email) {
        console.error(`Approver email not found for UID: ${pendingStep.uid}`);
        return;
    }

    const recipientEmail = approverData.email;
    const formUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/forms/${formData.id}`;
    const subject = `[Action Required] New Form for Your Approval: ${formData.type.toUpperCase()}`;
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Form for Approval</title>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f0fff0; margin: 0; padding: 0; text-align: center; }
                .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 0; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; text-align: left; }
                .header { background-image: linear-gradient(to right, #7cc56f, #4caf50); color: #ffffff; padding: 20px; text-align: center; }
                .logo-container { width: 80px; height: 80px; background-image: linear-gradient(to right, #7cc56f, #4caf50); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); vertical-align: middle; }
                .logo-text { color: #ffffff; font-size: 32px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
                h2 { margin-top: 10px; font-size: 24px; text-align: center; }
                .content { padding: 30px; color: #333333; line-height: 1.6; text-align: left; }
                .info-box { background-color: #e8f5e9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .info-box p { margin: 0 0 10px 0; }
                .info-box strong { color: #388e3c; }
                .button { display: inline-block; padding: 12px 24px; margin-top: 20px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #777777; border-top: 1px solid #dddddd; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo-container">
                        <span class="logo-text">POA</span>
                    </div>
                    <h2>New Form for Your Approval</h2>
                </div>
                <div class="content">
                    <p>Hello ${pendingStep.nama},</p>
                    <p>A new ${formData.type.toUpperCase()} form has been submitted by ${formData.requesterName}, and it requires your approval.</p>
                    
                    <h3>Form Details</h3>
                    <div class="info-box">
                        <p><strong>Form ID:</strong> ${formData.id}</p>
                        <p><strong>Submitted By:</strong> ${formData.requesterName}</p>
                        <p><strong>Submission Date:</strong> ${formData.createdAt ? new Date(formData.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
                        <p><strong>Reason:</strong> ${formData.alasan}</p>
                    </div>

                    <p>Please log in to the Prestova One Approval system to review and approve the form.</p>
                    
                    <p>Thank you,</p>
                    <p>The ${APP_NAME} Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>${APP_NAME}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    await mailTransport.sendMail({
        from: `${APP_NAME} <${process.env.MAIL_USER}>`,
        to: recipientEmail,
        subject,
        html,
    });
}

// Fungsi yang sudah ada di kode Anda, diubah menjadi fungsi terpisah
async function sendBroadcastEmail(formData: any) {
    // 1. Ambil email requester
    const requesterUid = formData.requesterUid;
    const requesterDoc = await getDoc(doc(db, 'users', requesterUid));
    const requesterEmail = requesterDoc.exists() ? requesterDoc.data()?.email : null;

    // 2. Ambil email Manager & General Manager dari approvalFlow
    const approvalFlow = formData.approvalFlow || [];
    const managerStep = approvalFlow.find((step: any) => step.role === 'manager');
    const gmStep = approvalFlow.find((step: any) => step.role === 'general_manager');

    const managerEmail = managerStep?.uid
        ? (await getDoc(doc(db, 'users', managerStep.uid))).data()?.email
        : null;

    const gmEmail = gmStep?.uid
        ? (await getDoc(doc(db, 'users', gmStep.uid))).data()?.email
        : null;

    // 3. Ambil email HRD & Finance dari koleksi settings
    const settingsDocRef = doc(db, 'settings', 'broadcast_emails');
    const settingsSnap = await getDoc(settingsDocRef);
    const broadcastEmails = settingsSnap.exists() ? settingsSnap.data() : { hrd: [], finance: [] };
    const hrdEmails = broadcastEmails.hrd || [];
    const financeEmails = broadcastEmails.finance || [];

    // Gabungkan semua email unik dalam satu array
    const allRecipients = [
        requesterEmail,
        managerEmail,
        gmEmail,
        ...hrdEmails,
        ...financeEmails
    ].filter(email => email);

    const uniqueRecipients = [...new Set(allRecipients)];

    if (uniqueRecipients.length === 0) {
        return NextResponse.json({ success: false, message: 'No recipients found to send the email.' }, { status: 404 });
    }

    const subject = `[Form Approval Broadcast] Fully Approved Form: ${formData.type.toUpperCase()}`;
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Form Fully Approved</title>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f0fff0; margin: 0; padding: 0; text-align: center; }
                .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 0; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; text-align: left; }
                .header { background-image: linear-gradient(to right, #7cc56f, #4caf50); color: #ffffff; padding: 20px; text-align: center; }
                .logo-container { width: 80px; height: 80px; background-image: linear-gradient(to right, #7cc56f, #4caf50); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); vertical-align: middle; }
                .logo-text { color: #ffffff; font-size: 32px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
                h2 { margin-top: 10px; font-size: 24px; text-align: center; }
                .content { padding: 30px; color: #333333; line-height: 1.6; text-align: left; }
                .info-box { background-color: #e8f5e9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .info-box p { margin: 0 0 10px 0; }
                .info-box strong { color: #388e3c; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #777777; border-top: 1px solid #dddddd; margin-top: 20px; }
                .details-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                .details-table th, .details-table td { padding: 8px; border: 1px solid #ddd; text-align: left; }
                .details-table th { background-color: #f2f2f2; }
                .approval-step { margin-bottom: 15px; padding: 10px; border: 1px solid #c8e6c9; border-radius: 4px; background-color: #f1f8e9; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo-container">
                        <span class="logo-text">POA</span>
                    </div>
                    <h2>Form Fully Approved</h2>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>The following form has been fully approved and is being broadcast to all related parties:</p>

                    <h3>Form Details</h3>
                    <div class="info-box">
                        <p><strong>Form ID:</strong> ${formData.id}</p>
                        <p><strong>Request Type:</strong> ${formData.type.toUpperCase()}</p>
                        <p><strong>Submitted By:</strong> ${formData.requesterName}</p>
                        <p><strong>Submission Date:</strong> ${formData.createdAt ? new Date(formData.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
                    </div>
                    
                    <h3>Approval History</h3>
                    ${approvalFlow.length > 0 ? approvalFlow.map((step: any) => `
                        <div class="approval-step">
                            <p><strong>Role:</strong> ${step.role.replace('_', ' ').split(' ').map((s: string) => s.charAt(0).toUpperCase() + s.substring(1)).join(' ')}</p>
                            <p><strong>Approved By:</strong> ${step.approvedByName || 'N/A'}</p>
                            <p><strong>Status:</strong> <span style="color: ${step.status === 'approved' ? '#4CAF50' : '#f44336'};">${step.status.toUpperCase()}</span></p>
                            <p><strong>Date:</strong> ${step.approvedAt ? new Date(step.approvedAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
                            ${step.comments ? `<p><strong>Comments:</strong> <em>"${step.comments}"</em></p>` : ''}
                        </div>
                    `).join('') : '<p>No approval history available.</p>'}

                    <p>Please log in to the Prestova One Approval system to view the complete details and attachments.</p>
                    <p>Thank you,</p>
                    <p>The ${APP_NAME} Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>${APP_NAME}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const emailPromises = uniqueRecipients.map((email: string) =>
        mailTransport.sendMail({
            from: `${APP_NAME} <${process.env.MAIL_USER}>`,
            to: email,
            subject,
            html,
        })
    );

    await Promise.all(emailPromises);

    return NextResponse.json({ success: true, message: 'Broadcast emails sent successfully.' });
}

export async function POST(request: Request) {
    try {
        const { formId } = await request.json();

        if (!formId) {
            return NextResponse.json({ success: false, message: 'Form ID is required.' }, { status: 400 });
        }

        const formDocRef = doc(db, 'forms', formId);
        const formSnap = await getDoc(formDocRef);

        if (!formSnap.exists()) {
            return NextResponse.json({ success: false, message: 'Form not found.' }, { status: 404 });
        }

        const formData = formSnap.data();
        const firstApprovalStep = formData?.approvalFlow?.[0];

        // Memeriksa status langkah persetujuan pertama untuk menentukan jenis email
        if (firstApprovalStep?.status === 'pending') {
            await sendApprovalRequestEmail(formData);
            return NextResponse.json({ success: true, message: 'Approval request email sent successfully.' });
        } else if (formData?.status === 'approved' || formData?.status === 'fully_approved') {
            await sendBroadcastEmail(formData);
            return NextResponse.json({ success: true, message: 'Broadcast email sent successfully.' });
        } else {
            return NextResponse.json({ success: false, message: 'No email sent. Form status is not supported.' }, { status: 400 });
        }
    } catch (error) {
        console.error("Error sending email:", error);
        return NextResponse.json({ success: false, message: 'Failed to send email.' }, { status: 500 });
    }
}