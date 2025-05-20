// ReportsScreen.js
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Platform, SafeAreaView
} from 'react-native';
import { db } from '../../firebaseConfig'; // Adjust path
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const ACCENT_COLOR = '#FF0000';
const PRIMARY_TEXT_COLOR = '#1A202C';
const SECONDARY_TEXT_COLOR = '#4A5568';
const LIGHT_BACKGROUND_COLOR = '#F7FAFC';
const CARD_BACKGROUND_COLOR = '#FFFFFF';
const BORDER_COLOR = '#E2E8F0';
const SUCCESS_COLOR = '#38A169';

const ensureDateObject = (timestampField) => {
    if (!timestampField) return null;
    if (timestampField instanceof Date) return timestampField;
    if (timestampField && typeof timestampField.toDate === 'function') return timestampField.toDate();
    if (typeof timestampField === 'object' && 'seconds' in timestampField && 'nanoseconds' in timestampField) {
        try { return new Timestamp(timestampField.seconds, timestampField.nanoseconds).toDate(); }
        catch (e) { console.warn("Could not convert object to Date:", timestampField, e); return null; }
    }
    if (typeof timestampField === 'string') {
        const parsedDate = new Date(timestampField);
        if (!isNaN(parsedDate.getTime())) return parsedDate;
    }
    console.warn("Unsupported date format for ensureDateObject:", timestampField);
    return null;
};

const formatDateForDisplay = (dateInput) => {
    const dateObj = ensureDateObject(dateInput);
    if (!dateObj) return 'N/A';
    return `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
};

const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) amount = 0;
    return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const getPredefinedDateRanges = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    return {
        currentMonth: {
            label: 'Current Month',
            startDate: new Date(currentYear, currentMonth, 1, 0, 0, 0),
            endDate: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59),
        },
        last3Months: {
            label: 'Last 3 Months',
            startDate: new Date(new Date(currentYear, currentMonth - 2, 1).setHours(0, 0, 0, 0)),
            endDate: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59),
        },
        last6Months: {
            label: 'Last 6 Months',
            startDate: new Date(new Date(currentYear, currentMonth - 5, 1).setHours(0, 0, 0, 0)),
            endDate: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59),
        },
        customMonth: { label: 'Custom Month', startDate: null, endDate: null }
    };
};

export default function ReportsScreen() {
    const [loading, setLoading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [selectedPeriodKey, setSelectedPeriodKey] = useState('currentMonth');

    const currentYear = new Date().getFullYear();
    const [pickerYear, setPickerYear] = useState(currentYear);
    const [pickerMonth, setPickerMonth] = useState(new Date().getMonth()); // 0-indexed (0 for Jan, 11 for Dec)
    const yearsForPicker = Array.from({ length: 5 }, (_, i) => currentYear - i);

    const monthsForPicker = Array.from({ length: 12 }, (_, i) => ({
        label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
        value: i // 0 for January, 11 for December
    }));

    const predefinedDateRanges = getPredefinedDateRanges();

    const getReportDateRange = () => {
        if (selectedPeriodKey === 'customMonth') {
            const startDate = new Date(pickerYear, pickerMonth, 1, 0, 0, 0);
            const endDate = new Date(pickerYear, pickerMonth + 1, 0, 23, 59, 59);
            const monthLabelObj = monthsForPicker.find(m => m.value === pickerMonth);
            const monthLabel = monthLabelObj ? monthLabelObj.label : `Month ${pickerMonth + 1}`;
            return { startDate, endDate, label: `${monthLabel} ${pickerYear}` };
        }
        const range = predefinedDateRanges[selectedPeriodKey];
        return { ...range, label: range.label };
    };

    const processOrderDataForReport = (querySnapshot, reportPeriodConfig) => {
        let totalSalesDelivered = 0, pendingOrdersAmount = 0, activeOrdersAmount = 0,
            bnplOrdersAmountTotal = 0, codOrdersAmountTotal = 0,
            totalOrdersCount = 0, // Will count ALL orders, including cancelled
            installmentPlanOrdersCount = 0, fixedDurationPlanOrdersCount = 0,
            overallTotalSalesInPeriod = 0; // Will sum grandTotal from non-cancelled orders

        const statusCounts = {};
        const bnplUsersPaymentStatus = { onTime: [], overdue: [] };
        const today = new Date();
        const detailedOrdersForPdf = [];
        const installmentsPaidThisPeriod = [];

        querySnapshot.forEach(doc => {
            const orderData = doc.data();
            const order = {
                ...orderData, id: doc.id,
                createdAt: ensureDateObject(orderData.createdAt),
                paymentDueDate: ensureDateObject(orderData.paymentDueDate),
                paymentReceivedAt: ensureDateObject(orderData.paymentReceivedAt),
                codPaymentReceivedAt: ensureDateObject(orderData.codPaymentReceivedAt),
                deliveredAt: ensureDateObject(orderData.deliveredAt),
                shippedAt: ensureDateObject(orderData.shippedAt),
                installments: (orderData.installments || []).map(inst => ({
                    ...inst,
                    dueDate: ensureDateObject(inst.dueDate),
                    paidAt: ensureDateObject(inst.paidAt),
                }))
            };
            detailedOrdersForPdf.push(order);

            // Increment totalOrdersCount for every order document found in the period
            totalOrdersCount++;

            if (order.status !== 'Cancelled') {
                // overallTotalSalesInPeriod and other sales-related calculations
                // should still likely exclude cancelled orders.
                overallTotalSalesInPeriod += order.grandTotal || 0;
            }

            if (order.status) statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
            if (order.status === 'Delivered') totalSalesDelivered += order.grandTotal || 0;
            if (order.status?.toLowerCase().includes('pending') || order.status?.toLowerCase().includes('unpaid')) pendingOrdersAmount += order.grandTotal || 0;
            if (order.status === 'Active') activeOrdersAmount += order.grandTotal || 0;

            const pmLower = order.paymentMethod?.toLowerCase();
            if (pmLower === 'bnpl' || (pmLower === 'mixed' && (order.bnplAmount || 0) > 0)) bnplOrdersAmountTotal += order.grandTotal || 0;
            if (pmLower === 'cod' || (pmLower === 'mixed' && (order.codAmount || 0) > 0)) codOrdersAmountTotal += order.grandTotal || 0;

            if (pmLower === 'bnpl' && order.installments?.length > 0) installmentPlanOrdersCount++;
            if (pmLower === 'fixed duration') fixedDurationPlanOrdersCount++;
            if (pmLower === 'mixed') {
                if (order.installments?.length > 0) installmentPlanOrdersCount++;
                if (order.fixedDurationDetails || order.paymentDueDate) fixedDurationPlanOrdersCount++;
            }

            let paidInThisOrderCount = 0;
            const totalInstallmentsInThisOrder = order.installments?.length || 0;

            (order.installments || []).forEach(inst => {
                const dueDate = inst.dueDate; const paidAt = inst.paidAt;
                if (inst.status?.toLowerCase() === 'paid') {
                    paidInThisOrderCount++;
                    if (paidAt && dueDate) {
                        const paymentEntry = { user: order.userName, userAddress: order.userAddress, orderId: order.id, installment: inst.installmentNumber, amount: inst.amount, paidAt: formatDateForDisplay(paidAt) };
                        if (paidAt <= dueDate) bnplUsersPaymentStatus.onTime.push(paymentEntry);
                        else bnplUsersPaymentStatus.overdue.push({ ...paymentEntry, dueDate: formatDateForDisplay(dueDate), status: 'Paid Late' });
                    }
                    if (paidAt && paidAt >= reportPeriodConfig.startDate && paidAt <= reportPeriodConfig.endDate) {
                        installmentsPaidThisPeriod.push({
                            userName: order.userName, userPhone: order.userPhone, userAddress: order.userAddress,
                            orderId: order.id, orderGrandTotal: order.grandTotal,
                            installmentNumber: inst.installmentNumber, installmentAmount: inst.amount,
                            paidAt: formatDateForDisplay(paidAt),
                            installmentsPaidCount: 0, installmentsTotalCount: 0, installmentsLeftCount: 0,
                        });
                    }
                } else if (inst.status?.toLowerCase() === 'pending' && dueDate && dueDate < today) {
                    bnplUsersPaymentStatus.overdue.push({ user: order.userName, userAddress: order.userAddress, orderId: order.id, installment: inst.installmentNumber, amount: inst.amount, dueDate: formatDateForDisplay(dueDate), status: 'Pending Overdue' });
                }
            });
            installmentsPaidThisPeriod.forEach(paidEntry => {
                if (paidEntry.orderId === order.id) {
                    paidEntry.installmentsPaidCount = paidInThisOrderCount;
                    paidEntry.installmentsTotalCount = totalInstallmentsInThisOrder;
                    paidEntry.installmentsLeftCount = totalInstallmentsInThisOrder - paidInThisOrderCount;
                }
            });
        });
        return {
            totalSalesDelivered, pendingOrdersAmount, activeOrdersAmount,
            bnplOrdersAmountTotal, codOrdersAmountTotal, totalOrdersCount,
            statusCounts, installmentPlanOrdersCount, fixedDurationPlanOrdersCount,
            bnplUsersPaymentStatus, detailedOrdersForPdf, installmentsPaidThisPeriod,
            overallTotalSalesInPeriod
        };
    };

    const generateFinancialSummaryReport = async () => {
        setLoading(true); setReportData(null);
        const selectedRange = getReportDateRange();
        if (!selectedRange || !selectedRange.startDate || !selectedRange.endDate) {
            Alert.alert("Error", "Invalid period selected."); setLoading(false); return;
        }
        try {
            const ordersRef = collection(db, 'orders');
            const q = query(ordersRef,
                where('createdAt', '>=', Timestamp.fromDate(selectedRange.startDate)),
                where('createdAt', '<=', Timestamp.fromDate(selectedRange.endDate)),
            );
            const querySnapshot = await getDocs(q);
            const processedData = processOrderDataForReport(querySnapshot, { startDate: selectedRange.startDate, endDate: selectedRange.endDate });
            setReportData({
                title: `Financial Summary`, periodLabel: selectedRange.label,
                startDate: selectedRange.startDate, endDate: selectedRange.endDate, ...processedData
            });
        } catch (error) { Alert.alert("Error", `Report generation failed: ${error.message}`); }
        finally { setLoading(false); }
    };

    const generatePdfForSummary = async () => {
        if (!reportData) { Alert.alert("No Data", "Generate a report first."); return; }
        setGeneratingPdf(true);
        let html = `<html><head><meta charset="UTF-8"><style> body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 20px; font-size: 10px; color: #333; } h1 { color: ${ACCENT_COLOR}; text-align: center; font-size: 20px; margin-bottom: 8px; font-weight: 600;} .report-subtitle { text-align: center; font-size: 11px; color: #555; margin-bottom: 15px;} h2 { font-size: 15px; color: ${PRIMARY_TEXT_COLOR}; border-bottom: 1.5px solid ${ACCENT_COLOR}; padding-bottom: 4px; margin-top: 20px; font-weight: 500;} .section { margin-bottom: 18px; padding: 12px; border: 1px solid #E0E0E0; border-radius: 6px; background-color: #FCFCFC;} .metric { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #EAEAEA;} .metric:last-child { border-bottom: none; } .metric-label { font-weight: 500; color: ${SECONDARY_TEXT_COLOR}; } .metric-value { font-weight: 600; color: ${PRIMARY_TEXT_COLOR}; } table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9px;} th, td { border: 1px solid #D0D0D0; padding: 5px; text-align: left; word-break: break-word; } th { background-color: #F0F0F0; font-weight: 600; } .user-details-cell { font-size:9px; } .user-details-cell b { color: #333; } .user-details-cell small { color: #555; display:block; margin-top:1px; } .address-cell { max-width: 150px; font-size: 8px !important; } </style></head><body>`;
        html += `<h1>Financial Summary Report</h1>`;
        html += `<p class="report-subtitle">Period: ${reportData.periodLabel} (${formatDateForDisplay(reportData.startDate)} - ${formatDateForDisplay(reportData.endDate)})</p>`;
        html += `<p class="report-subtitle" style="font-size:9px;">Generated: ${new Date().toLocaleString()}</p><hr style="border:0; border-top:1px solid #ccc; margin-bottom:15px;"/>`;

        html += `<div class="section"><h2>Sales & Order Amounts</h2>`;
        html += `<div class="metric"><span class="metric-label">Total Sales (Delivered Orders):</span><span class="metric-value">${formatCurrency(reportData.totalSalesDelivered)}</span></div>`;
        html += `<div class="metric"><span class="metric-label">Pending Orders Amount:</span><span class="metric-value">${formatCurrency(reportData.pendingOrdersAmount)}</span></div>`;
        html += `<div class="metric"><span class="metric-label">Active Orders Amount:</span><span class="metric-value">${formatCurrency(reportData.activeOrdersAmount)}</span></div>`;
        html += `<div class="metric"><span class="metric-label">BNPL-involved Orders Amount:</span><span class="metric-value">${formatCurrency(reportData.bnplOrdersAmountTotal)}</span></div>`;
        html += `<div class="metric"><span class="metric-label">COD-involved Orders Amount:</span><span class="metric-value">${formatCurrency(reportData.codOrdersAmountTotal)}</span></div>`;
        html += `<hr style="border:0; border-top:1px dashed #bbb; margin: 8px 0;"/>`;
        html += `<div class="metric" style="padding-top: 8px;"><span class="metric-label" style="font-weight:bold; color:${ACCENT_COLOR};">Overall Sales in Period:</span><span class="metric-value" style="font-weight:bold; color:${ACCENT_COLOR};">${formatCurrency(reportData.overallTotalSalesInPeriod)}</span></div>`;
        html += `</div>`;

        html += `<div class="section"><h2>Order Statistics</h2>`;
        html += `<div class="metric"><span class="metric-label">Total Orders in Period:</span><span class="metric-value">${reportData.totalOrdersCount}</span></div>`;
        html += `<h3>Orders by Status:</h3>`;
        Object.entries(reportData.statusCounts).sort(([, a], [, b]) => b - a).forEach(([status, count]) => {
            if (count > 0) html += `<div class="metric"><span class="metric-label">${status}:</span><span class="metric-value">${count}</span></div>`;
        });
        html += `</div>`;

        html += `<div class="section"><h2>Scheduled Plan Orders</h2>`;
        html += `<div class="metric"><span class="metric-label">Installment Plan Orders:</span><span class="metric-value">${reportData.installmentPlanOrdersCount}</span></div>`;
        html += `<div class="metric"><span class="metric-label">Fixed Duration Plan Orders:</span><span class="metric-value">${reportData.fixedDurationPlanOrdersCount}</span></div>`;
        html += `</div>`;

        html += `<div class="section"><h2>Installments Paid in Period (${reportData.periodLabel})</h2>`;
        if (reportData.installmentsPaidThisPeriod && reportData.installmentsPaidThisPeriod.length > 0) {
            html += `<table><thead><tr><th>User Details</th><th>Order</th><th>Inst. #</th><th>Amount</th><th>Paid On</th><th>Order Progress</th></tr></thead><tbody>`;
            reportData.installmentsPaidThisPeriod.slice(0, 30).forEach(item => {
                html += `<tr>
                           <td class="user-details-cell"><b>Name:</b> ${item.userName || 'N/A'}<br/><small><b>Phone:</b> ${item.userPhone || 'N/A'}</small><br/><small class="address-cell"><b>Address:</b> ${item.userAddress || 'N/A'}</small></td>
                           <td>${item.orderId.substring(0, 6)}</td><td>${item.installmentNumber}</td>
                           <td>${formatCurrency(item.installmentAmount)}</td><td>${item.paidAt}</td>
                           <td>${item.installmentsPaidCount} of ${item.installmentsTotalCount} (${item.installmentsLeftCount} left)</td></tr>`;
            });
            html += `</tbody></table>`;
            if (reportData.installmentsPaidThisPeriod.length > 30) html += `<p style="font-size:8px; text-align:right;">...and ${reportData.installmentsPaidThisPeriod.length - 30} more.</p>`;
        } else { html += `<p>No installments were marked as paid in this period.</p>`; }
        html += `</div>`;

        html += `<div class="section"><h2>BNPL User Payment Insights</h2>`;
        html += `<h3>Paid On Time (${reportData.bnplUsersPaymentStatus.onTime.length})</h3>`;
        if (reportData.bnplUsersPaymentStatus.onTime.length > 0) {
            html += `<table><thead><tr><th>User Details</th><th>Order</th><th>Inst.#</th><th>Amount</th><th>Paid</th></tr></thead><tbody>`;
            reportData.bnplUsersPaymentStatus.onTime.slice(0, 20).forEach(item => {
                html += `<tr><td class="user-details-cell"><b>Name:</b> ${item.user || 'N/A'}<br/><small class="address-cell"><b>Address:</b> ${item.userAddress || 'N/A'}</small></td><td>${item.orderId.substring(0, 6)}</td><td>${item.installment}</td><td>${formatCurrency(item.amount)}</td><td>${item.paidAt}</td></tr>`;
            });
            html += `</tbody></table>`;
            if (reportData.bnplUsersPaymentStatus.onTime.length > 20) html += `<p style="font-size:8px; text-align:right;">...and ${reportData.bnplUsersPaymentStatus.onTime.length - 20} more.</p>`;
        } else { html += `<p>None.</p>`; }

        html += `<h3>Overdue / Paid Late (${reportData.bnplUsersPaymentStatus.overdue.length})</h3>`;
        if (reportData.bnplUsersPaymentStatus.overdue.length > 0) {
            html += `<table><thead><tr><th>User Details</th><th>Order</th><th>Inst.#</th><th>Amount</th><th>Due</th><th>Status</th><th>Paid</th></tr></thead><tbody>`;
            reportData.bnplUsersPaymentStatus.overdue.slice(0, 20).forEach(item => {
                html += `<tr><td class="user-details-cell"><b>Name:</b> ${item.user || 'N/A'}<br/><small class="address-cell"><b>Address:</b> ${item.userAddress || 'N/A'}</small></td><td>${item.orderId.substring(0, 6)}</td><td>${item.installment}</td><td>${formatCurrency(item.amount)}</td><td>${item.dueDate}</td><td>${item.status}</td><td>${item.paidAt || 'N/A'}</td></tr>`;
            });
            html += `</tbody></table>`;
            if (reportData.bnplUsersPaymentStatus.overdue.length > 20) html += `<p style="font-size:8px; text-align:right;">...and ${reportData.bnplUsersPaymentStatus.overdue.length - 20} more.</p>`;
        } else { html += `<p>None.</p>`; }
        html += `</div>`;
        html += `</body></html>`;

        try {
            const { uri } = await Print.printToFileAsync({ html, base64: false, width: 612, height: 792, });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Financial Summary', UTI: '.pdf' });
            } else { Alert.alert('Sharing not available'); }
        } catch (error) { Alert.alert("PDF Error", `Could not generate PDF. ${error.message}`); }
        finally { setGeneratingPdf(false); }
    };

    const renderReportDisplay = () => {
        if (loading && !reportData) return <View style={styles.centeredMessageContainer}><ActivityIndicator size="large" color={ACCENT_COLOR} /></View>;
        if (!reportData) return <View style={styles.centeredMessageContainer}><Text style={styles.placeholderText}>Select a period and click "Generate Report" to view summary.</Text></View>;

        return (
            <View style={styles.reportDisplayCard}>
                <Text style={styles.reportDisplayTitle}>{reportData.title} - <Text style={styles.reportPeriodSubTitle}>{reportData.periodLabel}</Text></Text>

                <View style={styles.reportSection}>
                    <Text style={styles.sectionHeader}>Sales & Order Amounts</Text>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>Total Sales (Delivered Only):</Text><Text style={styles.metricValue}>{formatCurrency(reportData.totalSalesDelivered)}</Text></View>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>Pending Orders Amount:</Text><Text style={styles.metricValue}>{formatCurrency(reportData.pendingOrdersAmount)}</Text></View>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>Active Orders Amount:</Text><Text style={styles.metricValue}>{formatCurrency(reportData.activeOrdersAmount)}</Text></View>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>BNPL-involved Orders:</Text><Text style={styles.metricValue}>{formatCurrency(reportData.bnplOrdersAmountTotal)}</Text></View>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>COD-involved Orders:</Text><Text style={styles.metricValue}>{formatCurrency(reportData.codOrdersAmountTotal)}</Text></View>
                    <View style={[styles.metricRow, styles.overallTotalRow]}>
                        <Text style={[styles.metricLabel, styles.overallTotalLabel]}>Overall Sales in Period:</Text>
                        <Text style={[styles.metricValue, styles.overallTotalValue]}>{formatCurrency(reportData.overallTotalSalesInPeriod)}</Text>
                    </View>
                </View>

                <View style={styles.reportSection}>
                    <Text style={styles.sectionHeader}>Order Statistics</Text>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>Total Orders in Period:</Text><Text style={styles.metricValue}>{reportData.totalOrdersCount}</Text></View>
                    <Text style={styles.subSectionHeader}>Orders by Status:</Text>
                    {Object.entries(reportData.statusCounts).sort(([, a], [, b]) => b - a).map(([status, count]) =>
                        count > 0 ? <View key={status} style={styles.metricRowSub}><Text style={styles.metricLabelSub}>{status}:</Text><Text style={styles.metricValueSub}>{count}</Text></View> : null
                    )}
                </View>

                <View style={styles.reportSection}>
                    <Text style={styles.sectionHeader}>Installments Paid ({reportData.periodLabel})</Text>
                    {reportData.installmentsPaidThisPeriod && reportData.installmentsPaidThisPeriod.length > 0 ? (
                        <>
                            {reportData.installmentsPaidThisPeriod.slice(0, 5).map((item, index) => (
                                <View key={`${item.orderId}-${item.installmentNumber}-${index}-paid`} style={styles.paidInstallmentItem}>
                                    <View style={styles.paidItemHeader}>
                                        <Text style={styles.paidInstallmentUser}>{item.userName}</Text>
                                        <Text style={styles.paidDateTextSmall}>Paid: {item.paidAt}</Text>
                                    </View>
                                    <Text style={styles.userDetailLabel}>Phone: <Text style={styles.userDetailValue}>{item.userPhone || 'N/A'}</Text></Text>
                                    <Text style={styles.userDetailLabel}>Address: <Text style={styles.userDetailValue} numberOfLines={2} ellipsizeMode="tail">{item.userAddress || 'N/A'}</Text></Text>
                                    <Text style={styles.paidInstallmentDetailText}>Order ID: {item.orderId.substring(0, 8)} (Total: {formatCurrency(item.orderGrandTotal || 0)})</Text>
                                    <Text style={styles.paidInstallmentDetailText}>
                                        Inst. #{item.installmentNumber} ({formatCurrency(item.installmentAmount)})
                                    </Text>
                                    <Text style={styles.paidInstallmentProgressText}>
                                        Order Progress: {item.installmentsPaidCount} of {item.installmentsTotalCount} paid ({item.installmentsLeftCount} left)
                                    </Text>
                                </View>
                            ))}
                            {reportData.installmentsPaidThisPeriod.length > 5 && (
                                <Text style={styles.detailNoteText}>Showing first 5. Full list in PDF.</Text>
                            )}
                        </>
                    ) : (
                        <Text style={styles.placeholderTextSmall}>No installments paid in this period.</Text>
                    )}
                </View>

                <View style={styles.reportSection}>
                    <Text style={styles.sectionHeader}>Scheduled Plan Orders</Text>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>Installment Plan Orders:</Text><Text style={styles.metricValue}>{reportData.installmentPlanOrdersCount}</Text></View>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>Fixed Duration Plan Orders:</Text><Text style={styles.metricValue}>{reportData.fixedDurationPlanOrdersCount}</Text></View>
                </View>

                <View style={styles.reportSection}>
                    <Text style={styles.sectionHeader}>BNPL User Payment Insights (Summary)</Text>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>Installments Paid On Time:</Text><Text style={styles.metricValue}>{reportData.bnplUsersPaymentStatus.onTime.length}</Text></View>
                    <View style={styles.metricRow}><Text style={styles.metricLabel}>Installments Overdue / Paid Late:</Text><Text style={styles.metricValue}>{reportData.bnplUsersPaymentStatus.overdue.length}</Text></View>
                    <Text style={styles.detailNoteText}>Full breakdown available in the generated PDF.</Text>
                </View>

                <TouchableOpacity style={styles.actionButtonPdf} onPress={generatePdfForSummary} disabled={generatingPdf}>
                    {generatingPdf ? <ActivityIndicator color="#fff" /> :
                        <View style={styles.buttonContent}>
                            <Ionicons name="document-text-outline" size={22} color={CARD_BACKGROUND_COLOR} style={{ marginRight: 10 }} />
                            <Text style={styles.actionButtonText}>Generate & Share PDF</Text>
                        </View>
                    }
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.controlsCard}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="options-outline" size={26} color={ACCENT_COLOR} style={styles.cardIcon} />
                        <Text style={styles.cardTitle}>Report Configuration</Text>
                    </View>

                    <Text style={styles.label}>Select Period:</Text>
                    <View style={styles.periodSegmentContainer}>
                        {Object.entries(predefinedDateRanges).map(([key, { label }], index, arr) => (
                            <TouchableOpacity
                                key={key}
                                style={[
                                    styles.segmentButton,
                                    index === 0 ? styles.segmentButtonFirst : {},
                                    index === arr.length - 1 ? styles.segmentButtonLast : {},
                                    selectedPeriodKey === key && styles.segmentButtonActive
                                ]}
                                onPress={() => { setSelectedPeriodKey(key); setReportData(null); }}
                            >
                                <Text style={[
                                    styles.segmentButtonText,
                                    selectedPeriodKey === key && styles.segmentButtonActiveText
                                ]}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.selectedPeriodLabelDisplay}>
                        Reporting For: <Text style={{ fontWeight: '600' }}>{getReportDateRange()?.label}</Text>
                    </Text>


                    {selectedPeriodKey === 'customMonth' && (
                        <View style={styles.customPickerSection}>
                            <Text style={styles.customPickerTitle}>Select Custom Month & Year</Text>
                            <View style={styles.customPickerRow}>
                                <View style={styles.pickerGroup}>
                                    <Text style={styles.pickerLabelText}>Year:</Text>
                                    <View style={styles.pickerInputContainer}>
                                        <Picker
                                            selectedValue={pickerYear}
                                            style={styles.pickerComponent}
                                            onValueChange={(itemValue) => { setPickerYear(itemValue); setReportData(null); }}
                                            itemStyle={styles.pickerItem} mode="dropdown"
                                        >
                                            {yearsForPicker.map(year => <Picker.Item key={year} label={String(year)} value={year} />)}
                                        </Picker>
                                    </View>
                                </View>
                                <View style={styles.pickerGroup}>
                                    <Text style={styles.pickerLabelText}>Month:</Text>
                                    <View style={styles.pickerInputContainer}>
                                        <Picker
                                            selectedValue={pickerMonth} // Uses 0-indexed pickerMonth
                                            style={styles.pickerComponent}
                                            onValueChange={(itemValue) => { setPickerMonth(itemValue); setReportData(null); }} // itemValue is 0-indexed
                                            itemStyle={styles.pickerItem} mode="dropdown"
                                        >
                                            {monthsForPicker.map(month => <Picker.Item key={month.value} label={month.label} value={month.value} />)}
                                        </Picker>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}


                    <TouchableOpacity style={styles.actionButton} onPress={generateFinancialSummaryReport} disabled={loading}>
                        {loading && !reportData ? <ActivityIndicator color="#fff" /> :
                            <View style={styles.buttonContent}>
                                <Ionicons name="analytics-outline" size={24} color={CARD_BACKGROUND_COLOR} style={{ marginRight: 10 }} />
                                <Text style={styles.actionButtonText}>Generate Report</Text>
                            </View>
                        }
                    </TouchableOpacity>
                </View>

                {renderReportDisplay()}
                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: LIGHT_BACKGROUND_COLOR },
    container: { flex: 1 },
    scrollContentContainer: { paddingHorizontal: 15, paddingVertical: 25, paddingBottom: 40 },

    controlsCard: {
        backgroundColor: CARD_BACKGROUND_COLOR, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 25,
        marginBottom: 30, elevation: 8, shadowColor: '#2D3748',
        shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 15,
    },
    cardHeader: {
        flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: BORDER_COLOR,
        paddingBottom: 18, marginBottom: 22,
    },
    cardIcon: { marginRight: 15, },
    cardTitle: { fontSize: 24, fontWeight: 'bold', color: PRIMARY_TEXT_COLOR },
    label: { fontSize: 18, fontWeight: '600', marginBottom: 15, color: SECONDARY_TEXT_COLOR, marginTop: 8 },

    periodSegmentContainer: {
        flexDirection: 'row', borderRadius: 12, borderWidth: 1.5,
        borderColor: ACCENT_COLOR, overflow: 'hidden', marginBottom: 10,
    },
    segmentButton: {
        flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
        borderRightWidth: 1.5, borderRightColor: ACCENT_COLOR, backgroundColor: CARD_BACKGROUND_COLOR,
    },
    segmentButtonFirst: {},
    segmentButtonLast: { borderRightWidth: 0, },
    segmentButtonActive: { backgroundColor: ACCENT_COLOR, },
    segmentButtonText: { color: ACCENT_COLOR, fontWeight: '600', fontSize: 13, textAlign: 'center', },
    segmentButtonActiveText: { color: CARD_BACKGROUND_COLOR, },
    selectedPeriodLabelDisplay: {
        fontSize: 15, fontWeight: '500', color: PRIMARY_TEXT_COLOR, textAlign: 'center',
        marginTop: 10, marginBottom: 20,
    },

    customPickerSection: { marginTop: 10, paddingTop: 20, borderTopWidth: 1, borderColor: BORDER_COLOR, marginBottom: 10 },
    customPickerTitle: { fontSize: 16, fontWeight: '600', color: SECONDARY_TEXT_COLOR, marginBottom: 15, textAlign: 'center', },
    customPickerRow: { flexDirection: Platform.OS === 'ios' ? 'column' : 'row', justifyContent: 'space-between', alignItems: Platform.OS === 'ios' ? 'stretch' : 'center', },
    pickerGroup: { flex: Platform.OS === 'ios' ? 0 : 1, marginHorizontal: Platform.OS === 'ios' ? 0 : 5, marginBottom: Platform.OS === 'ios' ? 15 : 0, },
    pickerLabelText: { fontSize: 14, fontWeight: '500', marginBottom: 8, color: SECONDARY_TEXT_COLOR, textAlign: Platform.OS === 'ios' ? 'left' : 'center', },
    pickerInputContainer: {
        backgroundColor: LIGHT_BACKGROUND_COLOR, borderRadius: 10, borderWidth: 1,
        borderColor: BORDER_COLOR, height: Platform.OS === 'ios' ? undefined : 55,
        justifyContent: Platform.OS === 'ios' ? undefined : 'center', overflow: 'hidden',
    },
    pickerComponent: { height: Platform.OS === 'ios' ? 180 : 55, width: '100%', color: PRIMARY_TEXT_COLOR },
    pickerItem: { height: Platform.OS === 'ios' ? 180 : undefined, color: PRIMARY_TEXT_COLOR, fontSize: Platform.OS === 'ios' ? 20 : 16 },

    actionButton: {
        backgroundColor: ACCENT_COLOR, paddingVertical: 16, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', elevation: 4, minHeight: 56, flexDirection: 'row', marginTop: 15,
        shadowColor: ACCENT_COLOR, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4,
    },
    actionButtonText: { color: CARD_BACKGROUND_COLOR, fontSize: 18, fontWeight: 'bold' },
    actionButtonPdf: {
        backgroundColor: SUCCESS_COLOR, paddingVertical: 16, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', elevation: 4, minHeight: 56, marginTop: 25, flexDirection: 'row',
        shadowColor: SUCCESS_COLOR, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4,
    },
    buttonContent: { flexDirection: 'row', alignItems: 'center' },

    centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 150 },
    placeholderText: { fontSize: 17, color: SECONDARY_TEXT_COLOR, textAlign: 'center', fontStyle: 'italic', lineHeight: 24 },
    reportDisplayCard: {
        backgroundColor: CARD_BACKGROUND_COLOR, borderRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 25, marginTop: 10,
        elevation: 6, shadowColor: '#2D3748', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 10,
    },
    reportDisplayTitle: {
        fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: ACCENT_COLOR,
        textAlign: 'center', paddingBottom: 15, borderBottomWidth: 1.5, borderBottomColor: '#FFD1D1',
    },
    reportPeriodSubTitle: { fontWeight: '500', fontSize: 17, color: SECONDARY_TEXT_COLOR },
    reportSection: { marginVertical: 22, },
    sectionHeader: { fontSize: 20, fontWeight: 'bold', color: PRIMARY_TEXT_COLOR, marginBottom: 18, paddingBottom: 12, borderBottomWidth: 1.5, borderColor: BORDER_COLOR },
    subSectionHeader: { fontSize: 17, fontWeight: '600', color: SECONDARY_TEXT_COLOR, marginTop: 18, marginBottom: 12 },
    metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F3F5', alignItems: 'center' },
    metricLabel: { fontSize: 16, color: SECONDARY_TEXT_COLOR, flexShrink: 1, marginRight: 10, flex: 1.5 },
    metricValue: { fontSize: 16, fontWeight: 'bold', color: PRIMARY_TEXT_COLOR, textAlign: 'right', flex: 1 },
    overallTotalRow: { marginTop: 15, paddingTop: 15, borderTopWidth: 2, borderTopColor: ACCENT_COLOR, },
    overallTotalLabel: { fontWeight: 'bold', color: ACCENT_COLOR, fontSize: 17, flex: 2 },
    overallTotalValue: { fontWeight: 'bold', color: ACCENT_COLOR, fontSize: 17, flex: 1 },
    metricRowSub: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginLeft: 15, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', },
    metricLabelSub: { fontSize: 15, color: SECONDARY_TEXT_COLOR, flexShrink: 1, flex: 1.5 },
    metricValueSub: { fontSize: 15, fontWeight: '500', color: PRIMARY_TEXT_COLOR, textAlign: 'right', flex: 1 },
    detailNoteText: { fontSize: 14, color: '#868E96', fontStyle: 'italic', textAlign: 'center', marginTop: 15 },

    paidInstallmentItem: {
        backgroundColor: '#F9FAFB', padding: 18, borderRadius: 12, marginBottom: 14,
        borderWidth: 1, borderColor: BORDER_COLOR,
    },
    paidItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    paidInstallmentUser: { fontSize: 17, fontWeight: 'bold', color: PRIMARY_TEXT_COLOR, },
    paidInstallmentUserPhone: { fontSize: 14, fontWeight: 'normal', color: SECONDARY_TEXT_COLOR, },
    paidDateTextSmall: { fontSize: 13, color: SUCCESS_COLOR, fontWeight: '600' },
    userDetailLabel: { fontSize: 14, color: SECONDARY_TEXT_COLOR, fontWeight: '600', marginTop: 5, },
    userDetailValue: { fontWeight: 'normal', color: PRIMARY_TEXT_COLOR, },
    paidInstallmentDetailText: { fontSize: 15, color: SECONDARY_TEXT_COLOR, marginBottom: 5, lineHeight: 22, },
    paidInstallmentDetailTextSmall: { fontSize: 13, color: SECONDARY_TEXT_COLOR, marginBottom: 4, lineHeight: 18, fontStyle: 'italic' },
    paidInstallmentProgressText: { fontSize: 15, color: ACCENT_COLOR, fontWeight: 'bold', marginTop: 8, },
    placeholderTextSmall: { fontSize: 15, color: SECONDARY_TEXT_COLOR, textAlign: 'center', fontStyle: 'italic', paddingVertical: 18, },
});