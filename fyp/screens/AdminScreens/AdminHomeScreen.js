import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    TouchableOpacity,
    Image,
    StatusBar,
    ActivityIndicator,
    Platform,
    RefreshControl
} from 'react-native';
import { BarChart, PieChart, StackedBarChart, LineChart } from 'react-native-chart-kit';
import AdminCustomDrawer from './AdminCustomDrawer';

import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
    getFirestore, collection, query, limit, FirestoreError,
    onSnapshot, Timestamp, where // getDocs no longer needed for earnings
} from 'firebase/firestore';
import { app, db } from '../../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;

const ADMIN_PROFILE_IMAGE_KEY = 'adminHeaderProfileImage';
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png';
const REFRESH_CONTROL_COLOR = '#FF0000';

// --- Chart Configurations ---
const baseChartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 10, },
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#ffa726' },
    propsForLabels: { fontSize: 10, }
};

const pieChartConfig = { /* ... (same as before) ... */
    ...baseChartConfig,
    color: (opacity = 1, index) => {
        const colors = ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
        return colors[index % colors.length] || `rgba(150, 150, 150, ${opacity})`;
    },
};
const orderSummaryStackedBarConfig = { /* ... (same as before) ... */
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    legendFontSize: 10,
    decimalPlaces: 0,
    propsForBackgroundLines: { stroke: '#eee', strokeDasharray: '0', strokeWidth: 0.5 },
    propsForLabels: { fontSize: 10, }
};
const earningsLineChartConfig = { /* ... (same as before) ... */
    ...baseChartConfig,
    color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`,
    strokeWidth: 2.5,
    propsForDots: { r: '5', strokeWidth: '2', stroke: 'rgb(0, 130, 130)', },
};


export default function AdminHomeScreen({ navigation }) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const [loadingUsers, setLoadingUsers] = useState(true);
    const [errorUsers, setErrorUsers] = useState(null);
    const [totalUsers, setTotalUsers] = useState(0);
    const [usersData, setUsersData] = useState([
        { name: 'Verified', population: 0, color: '#36A2EB', legendFontColor: '#333', legendFontSize: 14 },
        { name: 'Unverified', population: 0, color: '#FF6384', legendFontColor: '#333', legendFontSize: 14 },
    ]);

    const [loadingOrders, setLoadingOrders] = useState(true); // For general order counts
    const [errorOrders, setErrorOrders] = useState(null);   // For general order counts
    const [pendingOrders, setPendingOrders] = useState(0);
    const [activeOrders, setActiveOrders] = useState(0);
    const [shippedOrders, setShippedOrders] = useState(0);
    const [deliveredOrdersCount, setDeliveredOrdersCount] = useState(0);
    const [cancelledOrders, setCancelledOrders] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);

    const [profileImage, setProfileImage] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // State for Real-time Monthly Delivered Earnings
    const [loadingMonthlyEarningsRT, setLoadingMonthlyEarningsRT] = useState(true);
    const [errorMonthlyEarningsRT, setErrorMonthlyEarningsRT] = useState(null);
    const [monthlyEarningsDataRT, setMonthlyEarningsDataRT] = useState({
        labels: [],
        datasets: [{ data: [], color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})` }],
    });

    const [refreshing, setRefreshing] = useState(false);

    const adminProfileListenerUnsubscribe = useRef(null);
    const usersListenerUnsubscribe = useRef(null);
    const generalOrdersListenerUnsubscribe = useRef(null); // Renamed for clarity
    const monthlyEarningsListenerUnsubscribe = useRef(null); // New ref for earnings listener

    // --- (checkInitialAdminProfileImage, Admin Profile Listener, Users Listener - same as before) ---
    const checkInitialAdminProfileImage = useCallback(async () => { /* ... (same) ... */
        setLoadingProfile(true);
        try {
            const cachedImage = await AsyncStorage.getItem(ADMIN_PROFILE_IMAGE_KEY);
            if (cachedImage) setProfileImage(cachedImage);
        } catch (error) { console.error("Error reading admin profile image cache:", error); }
    }, []);

    useEffect(() => { /* ... (Admin Profile Listener - same) ... */
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (adminProfileListenerUnsubscribe.current) adminProfileListenerUnsubscribe.current();
            if (user) {
                checkInitialAdminProfileImage();
                const adminQuery = query(collection(db, "Admin"), limit(1));
                adminProfileListenerUnsubscribe.current = onSnapshot(adminQuery, async (snap) => {
                    if (!snap.empty) {
                        const adminData = snap.docs[0].data();
                        const imgUrl = adminData.profileImage?.trim() || null;
                        setProfileImage(imgUrl);
                        if (imgUrl) await AsyncStorage.setItem(ADMIN_PROFILE_IMAGE_KEY, imgUrl);
                        else await AsyncStorage.removeItem(ADMIN_PROFILE_IMAGE_KEY);
                    } else {
                        setProfileImage(null); await AsyncStorage.removeItem(ADMIN_PROFILE_IMAGE_KEY);
                    }
                    setLoadingProfile(false);
                }, (err) => {
                    console.error("Admin profile listener error:", err);
                    setProfileImage(null); setLoadingProfile(false);
                });
            } else {
                setProfileImage(null); setLoadingProfile(false);
                if (adminProfileListenerUnsubscribe.current) adminProfileListenerUnsubscribe.current();
            }
        });
        return () => {
            unsubscribeAuth();
            if (adminProfileListenerUnsubscribe.current) adminProfileListenerUnsubscribe.current();
        };
    }, [checkInitialAdminProfileImage]);

    useEffect(() => { /* ... (Users Listener - same) ... */
        setLoadingUsers(true); setErrorUsers(null);
        const usersColRef = collection(db, 'Users');
        usersListenerUnsubscribe.current = onSnapshot(usersColRef, (snapshot) => {
            setTotalUsers(snapshot.size);
            let vCount = 0, uCount = 0;
            snapshot.forEach(doc => doc.data()?.verificationStatus?.toLowerCase() === 'verified' ? vCount++ : uCount++);
            if (usersData[0].population !== vCount || usersData[1].population !== uCount) {
                setUsersData([{ ...usersData[0], population: vCount }, { ...usersData[1], population: uCount }]);
            }
            setLoadingUsers(false); setErrorUsers(null);
        }, (error) => {
            console.error("Users listener error:", error);
            setErrorUsers(`Failed to load users (${error.code || 'Unknown'})`); setLoadingUsers(false);
            setTotalUsers(0); setUsersData([{ ...usersData[0], population: 0 }, { ...usersData[1], population: 0 }]);
        });
        return () => { if (usersListenerUnsubscribe.current) usersListenerUnsubscribe.current(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Listener for General Order Counts (Pending, Active, etc.)
    useEffect(() => {
        setLoadingOrders(true); setErrorOrders(null);
        const ordersColRef = collection(db, 'orders');
        // This listener is broad; consider if a more targeted query is possible for counts
        // if performance becomes an issue. For now, it counts all statuses.
        generalOrdersListenerUnsubscribe.current = onSnapshot(ordersColRef, (snapshot) => {
            console.log(">>> General Orders Snapshot for Counts Received!");
            let p = 0, a = 0, s = 0, d = 0, c = 0;
            snapshot.forEach((doc) => {
                const status = doc.data().status?.trim().toLowerCase();
                if (status === 'pending') p++; else if (status === 'active') a++;
                else if (status === 'shipped') s++; else if (status === 'delivered') d++;
                else if (status === 'cancelled') c++;
            });
            setPendingOrders(p); setActiveOrders(a); setShippedOrders(s);
            setDeliveredOrdersCount(d); setCancelledOrders(c); setTotalOrders(snapshot.size);
            setLoadingOrders(false); setErrorOrders(null);
        }, (error) => {
            console.error("General Orders Listener error:", error);
            setErrorOrders(`Failed to load order counts (${error.code || 'Unknown'})`); setLoadingOrders(false);
            // Reset counts on error
            setPendingOrders(0); setActiveOrders(0); setShippedOrders(0);
            setDeliveredOrdersCount(0); setCancelledOrders(0); setTotalOrders(0);
        });
        return () => {
            if (generalOrdersListenerUnsubscribe.current) generalOrdersListenerUnsubscribe.current();
        };
    }, []);

    // --- NEW: Real-time Listener for Monthly Delivered Earnings ---
    useEffect(() => {
        setLoadingMonthlyEarningsRT(true);
        setErrorMonthlyEarningsRT(null);
        console.log("Setting up REAL-TIME listener for monthly delivered earnings...");

        const today = new Date();
        const numMonthsQuery = 7; // Fetch slightly more to cover edge cases with timezones/month ends
        const queryStartDate = new Date(today.getFullYear(), today.getMonth() - (numMonthsQuery - 1), 1);
        queryStartDate.setHours(0, 0, 0, 0);

        const ordersRef = collection(db, 'orders');
        // Query orders created in the last ~7 months. We'll filter for 'Delivered' and exact 6-month window client-side.
        // This query is less likely to require a complex index than one with status + date range.
        const q = query(ordersRef,
            where('createdAt', '>=', Timestamp.fromDate(queryStartDate))
            // No 'endDate' in listener query, as we want ongoing updates.
            // We will filter out older-than-6-months data client-side.
        );

        monthlyEarningsListenerUnsubscribe.current = onSnapshot(q, (snapshot) => {
            console.log(`>>> Monthly Earnings Snapshot Received! Processing ${snapshot.size} orders.`);
            const currentProcessingDate = new Date(); // Use a consistent 'today' for month calculations
            const numMonthsDisplay = 6;
            const displayMonthLabels = [];
            const monthlyEarningsMap = new Map();

            // Initialize map for the 6 display months
            for (let i = numMonthsDisplay - 1; i >= 0; i--) {
                const date = new Date(currentProcessingDate.getFullYear(), currentProcessingDate.getMonth() - i, 1);
                const monthYearKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                displayMonthLabels.push(date.toLocaleString('default', { month: 'short' }));
                monthlyEarningsMap.set(monthYearKey, 0);
            }
            const displayStartDate = new Date(currentProcessingDate.getFullYear(), currentProcessingDate.getMonth() - (numMonthsDisplay - 1), 1);
            displayStartDate.setHours(0,0,0,0);
            // End date for display window (end of current month)
            const displayEndDate = new Date(currentProcessingDate.getFullYear(), currentProcessingDate.getMonth() + 1, 0, 23, 59, 59, 999);


            snapshot.forEach(doc => {
                const order = doc.data();
                const status = order.status?.trim().toLowerCase();

                if (status !== 'delivered') return; // Only interested in delivered orders

                const createdAtTimestamp = order.createdAt;
                const grandTotal = typeof order.grandTotal === 'number' ? order.grandTotal : 0;

                if (createdAtTimestamp && createdAtTimestamp.toDate && grandTotal > 0) {
                    const orderDate = createdAtTimestamp.toDate();
                    // Ensure order falls within our 6-month display window
                    if (orderDate >= displayStartDate && orderDate <= displayEndDate) {
                        const monthYearKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                        if (monthlyEarningsMap.has(monthYearKey)) {
                            monthlyEarningsMap.set(monthYearKey, monthlyEarningsMap.get(monthYearKey) + grandTotal);
                        }
                    }
                }
            });

            const earningsValues = Array.from(monthlyEarningsMap.values());

            if (displayMonthLabels.length === 0 || earningsValues.every(v => v === 0)) {
                setMonthlyEarningsDataRT({ labels: ["No Data"], datasets: [{ data: [0], color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})` }] });
            } else {
                setMonthlyEarningsDataRT({
                    labels: displayMonthLabels,
                    datasets: [{ data: earningsValues, color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})` }],
                });
            }
            setErrorMonthlyEarningsRT(null);
            setLoadingMonthlyEarningsRT(false); // Set loading to false after first successful snapshot
        }, (error) => {
            console.error("Error in monthly earnings snapshot listener:", error);
            setErrorMonthlyEarningsRT("Failed to load real-time earnings. " + (error.message || ""));
            setMonthlyEarningsDataRT({ labels: ["Error"], datasets: [{ data: [0], color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})` }] });
            setLoadingMonthlyEarningsRT(false);
        });

        return () => {
            if (monthlyEarningsListenerUnsubscribe.current) {
                console.log("Cleaning up monthly earnings listener.");
                monthlyEarningsListenerUnsubscribe.current();
            }
        };
    }, []); // Empty dependency array ensures this runs once on mount

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        console.log("Pull-to-refresh triggered.");
        // Listeners will update data automatically.
        // This is mainly for visual feedback.
        // If you had one-time fetches, you'd re-trigger them here.
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    const orderSummaryData = { /* ... (same as before) ... */
        labels: ['Act', 'Pend', 'Del', 'Total'],
        legend: ['Orders'],
        data: [ [activeOrders], [pendingOrders], [deliveredOrdersCount], [totalOrders] ],
        barColors: [ REFRESH_CONTROL_COLOR, REFRESH_CONTROL_COLOR, REFRESH_CONTROL_COLOR, REFRESH_CONTROL_COLOR ],
    };
    const formatCurrencyYLabel = (yValue) => { /* ... (same as before, with Math.round) ... */
        const num = Number(yValue);
        if (isNaN(num)) return yValue;
        if (num === 0) return '0';

        if (num >= 1000000) {
            return `${Math.round(num / 1000000)}M`;
        }
        if (num >= 1000) {
            return `${Math.round(num / 1000)}K`;
        }
        return `${num.toFixed(0)}`;
    };

    return (
        <View style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={REFRESH_CONTROL_COLOR} />
            <View style={styles.headerBar}>
                {/* ... Header JSX ... */}
                <Image source={require('../../assets/logoh.png')} style={styles.logo} />
                <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}>
                        {loadingProfile ? <ActivityIndicator size="small" color="white" />
                            : <Image source={{ uri: profileImage || defaultProfileImageUri }} style={styles.profileImageStyle} />}
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContentContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={REFRESH_CONTROL_COLOR}
                        colors={[REFRESH_CONTROL_COLOR]} progressBackgroundColor="#ffffff" />
                }>
                {/* --- User Verification Chart --- */}
                <View style={styles.chartContainer}>
                    {/* ... User Chart JSX ... */}
                    <Text style={styles.chartTitle}>👤 User Verification Status</Text>
                    {!loadingUsers && !errorUsers && <Text style={styles.totalUsersText}>Total Users: {totalUsers}</Text>}
                    <View style={styles.chartRenderArea}>
                        {loadingUsers ? <ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} />
                            : errorUsers ? <Text style={styles.errorText}>{errorUsers}</Text>
                                : (usersData.some(item => item.population > 0)) ?
                                    <PieChart data={usersData.filter(item => item.population > 0)}
                                        width={screenWidth - 60} height={180} chartConfig={pieChartConfig}
                                        accessor="population" backgroundColor="transparent" paddingLeft="15"
                                        center={[10, 0]} absolute />
                                    : <Text style={styles.noDataText}>No user status data.</Text>}
                    </View>
                </View>

                {/* --- Order Status Summary Chart --- */}
                <View style={styles.chartContainer}>
                    {/* ... Order Summary Chart JSX ... */}
                    <Text style={styles.chartTitle}>📦 Order Status Summary</Text>
                    <View style={styles.chartRenderArea}>
                        {loadingOrders ? <ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} />
                            : errorOrders ? <Text style={styles.errorText}>{errorOrders}</Text>
                                : (totalOrders > 0 || pendingOrders > 0 || activeOrders > 0 || deliveredOrdersCount > 0 || shippedOrders > 0 || cancelledOrders > 0) ?
                                    <StackedBarChart style={styles.chartStyle} data={orderSummaryData}
                                        width={screenWidth - 40} height={240} chartConfig={orderSummaryStackedBarConfig}
                                        hideLegend={false} fromZero={true} />
                                    : <Text style={styles.noDataText}>No order data found.</Text>}
                    </View>
                    {!loadingOrders && !errorOrders && (
                        <View style={styles.orderCountsMainContainer}>
                            <View style={styles.orderCountsRow}><Text style={styles.orderCountText}>Pending: {pendingOrders}</Text><Text style={styles.orderCountText}>Active: {activeOrders}</Text><Text style={styles.orderCountText}>Shipped: {shippedOrders}</Text></View>
                            <View style={styles.orderCountsRow}><Text style={styles.orderCountText}>Delivered: {deliveredOrdersCount}</Text><Text style={styles.orderCountText}>Cancelled: {cancelledOrders}</Text><Text style={styles.orderCountText}>Total: {totalOrders}</Text></View>
                        </View>
                    )}
                </View>

                {/* --- CHART SECTION 3: Real-time Monthly Delivered Earnings (LINE CHART) --- */}
                <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>📈 Monthly Delivered Earnings Trend (Last 6 Months)</Text>
                    <View style={styles.chartRenderArea}>
                        {loadingMonthlyEarningsRT ? <ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} />
                            : errorMonthlyEarningsRT ? <Text style={styles.errorText}>{errorMonthlyEarningsRT}</Text>
                                : (monthlyEarningsDataRT.labels && monthlyEarningsDataRT.labels.length > 0 && monthlyEarningsDataRT.labels[0] !== "No Data" && monthlyEarningsDataRT.labels[0] !== "Error" && monthlyEarningsDataRT.datasets[0].data.some(val => val > 0)) ?
                                    <LineChart
                                        data={monthlyEarningsDataRT} // Use RT data state
                                        width={screenWidth - 40}
                                        height={240}
                                        chartConfig={earningsLineChartConfig}
                                        yAxisLabel="PKR "
                                        formatYLabel={formatCurrencyYLabel}
                                        bezier
                                        style={styles.chartStyle}
                                        fromZero={false}
                                        segments={4}
                                    />
                                    : <Text style={styles.noDataText}>No earnings data for the period.</Text>}
                    </View>
                </View>
            </ScrollView>

            {isDrawerOpen && ( /* ... Drawer JSX ... */
                <View style={styles.drawerOverlay}>
                    <AdminCustomDrawer navigation={navigation} closeDrawer={() => setIsDrawerOpen(false)} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({ /* ... (same as before) ... */
    safeArea: { flex: 1, backgroundColor: '#F5F5F5', },
    headerBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 15, height: 63, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, },
    logo: { width: 70, height: 55, resizeMode: 'contain', },
    profileIconContainer: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'white', justifyContent: 'center', alignItems: 'center', backgroundColor: '#D32F2F', overflow: 'hidden', },
    profileImageStyle: { width: '100%', height: '100%', borderRadius: 25, },
    drawerOverlay: { position: 'absolute', top: 0, bottom: 0, right: 0, left: 0, zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.3)', },
    container: { flex: 1, },
    scrollContentContainer: { padding: 15, paddingBottom: 30, },
    chartTitle: { fontSize: 18, fontWeight: '600', color: '#444', textAlign: 'center', marginBottom: 10, paddingHorizontal: 10, },
    totalUsersText: { fontSize: 16, fontWeight: '500', color: '#666', textAlign: 'center', marginBottom: 10, },
    chartContainer: { backgroundColor: '#ffffff', borderRadius: 10, paddingVertical: 15, paddingHorizontal: 10, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.23, shadowRadius: 2.62, elevation: 4, },
    chartRenderArea: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 240, },
    chartStyle: { marginVertical: 8, borderRadius: 10, },
    errorText: { color: '#D8000C', backgroundColor: '#FFD2D2', padding: 10, borderRadius: 5, textAlign: 'center', fontSize: 15, marginHorizontal: 10, },
    noDataText: { color: '#555', textAlign: 'center', fontSize: 15, fontStyle: 'italic', marginTop: 20, marginBottom: 20 },
    orderCountsMainContainer: { marginTop: 15, paddingHorizontal: 5, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, },
    orderCountsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8, width: '100%', },
    orderCountText: { fontSize: 13, color: '#555', fontWeight: '500', textAlign: 'center', flex: 1, },
});