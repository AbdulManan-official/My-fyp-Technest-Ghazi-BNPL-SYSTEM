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
// --- Import Chart Components ---
import { LineChart, BarChart, PieChart, StackedBarChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/FontAwesome';
import AdminCustomDrawer from './AdminCustomDrawer'; // Assuming this component exists

// --- Firebase & AsyncStorage Imports ---
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
    getFirestore, collection, query, limit, FirestoreError,
    onSnapshot // Keep onSnapshot for Users AND Orders listeners
} from 'firebase/firestore';
// --- Ensure db is correctly imported from your firebaseConfig ---
import { app, db } from '../../firebaseConfig'; // Make sure this path is correct
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;

// --- Constants ---
const ADMIN_PROFILE_IMAGE_KEY = 'adminHeaderProfileImage';
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png';
const REFRESH_CONTROL_COLOR = '#FF0000'; // Red color

// --- Chart Configurations (Defined ONCE, before the component) ---
const chartConfigBase = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 10, },
    propsForDots: { r: '6', strokeWidth: '2', stroke: '#36A2EB', },
};

const pieChartConfig = {
    ...chartConfigBase,
    color: (opacity = 1, index) => {
        const colors = ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
        return colors[index % colors.length] || `rgba(150, 150, 150, ${opacity})`;
    },
};

const stackedBarChartConfig = {
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // Base color red (overridden by barColors in data)
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    legendFontSize: 10,
    legendFontColor: '#000',
    decimalPlaces: 0,
    propsForBackgroundLines: { stroke: '#eee', strokeDasharray: '0', strokeWidth: 0.5 },
};
// --- End of Chart Configurations ---


export default function AdminHomeScreen({ navigation }) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // --- User Chart State (Uses Firebase) ---
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [errorUsers, setErrorUsers] = useState(null);
    const [totalUsers, setTotalUsers] = useState(0);
    const [usersData, setUsersData] = useState([
        { name: 'Verified', population: 0, color: '#36A2EB', legendFontColor: '#333', legendFontSize: 14 },
        { name: 'Unverified', population: 0, color: '#FF6384', legendFontColor: '#333', legendFontSize: 14 },
    ]);

    // --- Order Chart State (Uses Firebase) ---
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [errorOrders, setErrorOrders] = useState(null);
    const [pendingOrders, setPendingOrders] = useState(0);
    const [activeOrders, setActiveOrders] = useState(0);
    const [shippedOrders, setShippedOrders] = useState(0);
    const [deliveredOrders, setDeliveredOrders] = useState(0);
    const [cancelledOrders, setCancelledOrders] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);

    // --- Admin Profile State (Uses Firebase) ---
    const [profileImage, setProfileImage] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // --- Refresh State ---
    const [refreshing, setRefreshing] = useState(false);

    // --- Listener Refs ---
    const adminProfileListenerUnsubscribe = useRef(null);
    const usersListenerUnsubscribe = useRef(null);
    const ordersListenerUnsubscribe = useRef(null);

    // --- Initial Cache Check (Admin Profile - Uses AsyncStorage) ---
    const checkInitialAdminProfileImage = useCallback(async () => {
        setLoadingProfile(true);
        const cacheKey = ADMIN_PROFILE_IMAGE_KEY;
        try {
            const cachedImage = await AsyncStorage.getItem(cacheKey);
            if (cachedImage) { setProfileImage(cachedImage); }
        } catch (error) { console.error("Error reading admin profile image cache:", error); }
        // Loading state handled by listener
    }, []);

    // --- Auth State & Admin Profile Listener (Uses Firebase) ---
    useEffect(() => {
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (adminProfileListenerUnsubscribe.current) {
                adminProfileListenerUnsubscribe.current();
                adminProfileListenerUnsubscribe.current = null;
            }
            if (user) {
                checkInitialAdminProfileImage();
                const adminQuery = query(collection(db, "Admin"), limit(1));
                adminProfileListenerUnsubscribe.current = onSnapshot(adminQuery, async (querySnapshot) => {
                     if (!querySnapshot.empty) {
                        const adminDoc = querySnapshot.docs[0];
                        const data = adminDoc.data();
                        const imageUrl = data.profileImage?.trim() || null;
                        setProfileImage(imageUrl);
                        try {
                            if (imageUrl) await AsyncStorage.setItem(ADMIN_PROFILE_IMAGE_KEY, imageUrl);
                            else await AsyncStorage.removeItem(ADMIN_PROFILE_IMAGE_KEY);
                        } catch (cacheError) { console.error("Error updating admin profile cache:", cacheError); }
                    } else {
                        setProfileImage(null);
                        try { await AsyncStorage.removeItem(ADMIN_PROFILE_IMAGE_KEY); } catch(e){}
                    }
                    setLoadingProfile(false);
                }, (error) => {
                    console.error("Error listening admin profile:", error);
                    setProfileImage(null); setLoadingProfile(false);
                });
            } else {
                setProfileImage(null); setLoadingProfile(false);
                 if (adminProfileListenerUnsubscribe.current) {
                    adminProfileListenerUnsubscribe.current();
                    adminProfileListenerUnsubscribe.current = null;
                }
            }
        });
        return () => {
            unsubscribeAuth();
            if (adminProfileListenerUnsubscribe.current) {
                adminProfileListenerUnsubscribe.current();
            }
        };
    }, [checkInitialAdminProfileImage]);

    // --- Users Collection Listener (Uses Firebase) ---
    useEffect(() => {
        setLoadingUsers(true);
        setErrorUsers(null);
        const usersColRef = collection(db, 'Users');
        usersListenerUnsubscribe.current = onSnapshot(usersColRef, (snapshot) => {
             setTotalUsers(snapshot.size);
            let verifiedCount = 0; let unverifiedCount = 0;
            snapshot.forEach((doc) => {
                const status = doc.data()?.verificationStatus;
                if (typeof status === 'string' && status.toLowerCase() === 'verified') {
                     verifiedCount++;
                } else {
                    unverifiedCount++;
                }
            });
            // Avoid unnecessary state update if data hasn't changed
            if (usersData[0].population !== verifiedCount || usersData[1].population !== unverifiedCount) {
                const newUsersData = [
                    { ...usersData[0], population: verifiedCount },
                    { ...usersData[1], population: unverifiedCount },
                ];
                setUsersData(newUsersData);
            }
            setLoadingUsers(false); setErrorUsers(null);
        }, (error) => {
             console.error("Firebase Snapshot Error (Users):", error);
            let errorMessage = "Failed load real-time user data.";
            if (error instanceof FirestoreError) {
                errorMessage += ` (Code: ${error.code})`;
                if (error.code === 'permission-denied') errorMessage = "Permission denied Users listener.";
            }
            setErrorUsers(errorMessage);
            setLoadingUsers(false); setTotalUsers(0);
            setUsersData([ { ...usersData[0], population: 0 }, { ...usersData[1], population: 0 } ]);
        });
        return () => {
            if (usersListenerUnsubscribe.current) usersListenerUnsubscribe.current();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Keeping dependencies minimal for listeners if possible

    // --- Orders Collection Listener (Uses Firebase) ---
    useEffect(() => {
        setLoadingOrders(true);
        setErrorOrders(null);
        const ordersColRef = collection(db, 'orders');

        console.log("Setting up listener for 'orders' collection...");

        ordersListenerUnsubscribe.current = onSnapshot(ordersColRef, (snapshot) => {
            console.log(`>>> Orders Snapshot Received! Size: ${snapshot.size}, Empty: ${snapshot.empty}`);

            let pending = 0;
            let active = 0;
            let shipped = 0;
            let delivered = 0;
            let cancelled = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                const status = data.status?.trim();

                if (!status) {
                    console.warn(`Order document ${doc.id} missing 'status' field or field is empty.`);
                    return;
                }

                const normalizedStatus = status.toLowerCase();

                if (normalizedStatus === 'pending') pending++;
                else if (normalizedStatus === 'active') active++;
                else if (normalizedStatus === 'shipped') shipped++;
                else if (normalizedStatus === 'delivered') delivered++;
                else if (normalizedStatus === 'cancelled') cancelled++;
            });

            console.log(`Counts - Pending: ${pending}, Active: ${active}, Shipped: ${shipped}, Delivered: ${delivered}, Cancelled: ${cancelled}, Total Docs: ${snapshot.size}`);

            setPendingOrders(pending);
            setActiveOrders(active);
            setShippedOrders(shipped);
            setDeliveredOrders(delivered);
            setCancelledOrders(cancelled);
            setTotalOrders(snapshot.size);
            setLoadingOrders(false);
            setErrorOrders(null);

        }, (error) => {
            console.error(">>> ORDERS LISTENER ERROR:", error);
            let errorMessage = "Failed to load real-time order data.";
            if (error instanceof FirestoreError) {
                errorMessage += ` (Code: ${error.code})`;
                if (error.code === 'permission-denied') {
                    errorMessage = "Permission denied reading 'orders' collection. Check Firestore rules.";
                } else {
                    errorMessage += ` (${error.message})`;
                }
            } else {
                 errorMessage += ` (${error.message || 'Unknown error'})`;
            }
            setErrorOrders(errorMessage);
            setLoadingOrders(false);
            setPendingOrders(0);
            setActiveOrders(0);
            setShippedOrders(0);
            setDeliveredOrders(0);
            setCancelledOrders(0);
            setTotalOrders(0);
        });

        // Cleanup function
        return () => {
            console.log("Cleaning up 'orders' listener.");
            if (ordersListenerUnsubscribe.current) {
                ordersListenerUnsubscribe.current();
                ordersListenerUnsubscribe.current = null;
            }
        };
    }, []); // Empty dependency array

    // --- onRefresh Handler (Visual Feedback Only) ---
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        console.log("Pull-to-refresh triggered");
        // Note: Real-time listeners handle data updates automatically.
        // This refresh is mainly for user feedback.
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    // --- Prepare data for Stacked Bar Chart ---
     const stackedOrderData = {
        labels: ['Act', 'Pend', 'Del', 'Total'],
        legend: ['Orders'],
        data: [
          [activeOrders],
          [pendingOrders],
          [deliveredOrders],
          [totalOrders],
        ],
        // Bars are RED
        barColors: [
            REFRESH_CONTROL_COLOR,
            REFRESH_CONTROL_COLOR,
            REFRESH_CONTROL_COLOR,
            REFRESH_CONTROL_COLOR
        ],
      };

    // --- Render ---
    return (
        <View style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={REFRESH_CONTROL_COLOR} />

            {/* Header */}
            <View style={styles.headerBar}>
                 <Image source={require('../../assets/logoh.png')} style={styles.logo} />
                <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                     <View style={styles.profileIconContainer}>
                        {loadingProfile ? ( <ActivityIndicator size="small" color="white" /> )
                         : ( <Image source={{ uri: profileImage || defaultProfileImageUri }} style={styles.profileImageStyle}/> )}
                    </View>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={REFRESH_CONTROL_COLOR}
                        colors={[REFRESH_CONTROL_COLOR]}
                        progressBackgroundColor="#ffffff"
                    />
                 }
            >
                {/* User Status Pie Chart Section */}
                <View style={styles.chartContainer}>
                     <Text style={styles.chartTitle}>👤 User Verification Status</Text>
                    {!loadingUsers && !errorUsers && <Text style={styles.totalUsersText}>Total Users: {totalUsers}</Text>}
                    <View style={styles.chartRenderArea}>
                        {loadingUsers ? <ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} />
                         : errorUsers ? <Text style={styles.errorText}>{errorUsers}</Text>
                         : (usersData.some(item => item.population > 0)) ?
                            <PieChart
                                data={usersData.filter(item => item.population > 0)}
                                width={screenWidth - 60} height={180} chartConfig={pieChartConfig}
                                accessor="population" backgroundColor="transparent" paddingLeft="15"
                                center={[10, 0]} absolute
                            />
                          : <Text style={styles.noDataText}>No user status data available.</Text>}
                    </View>
                </View>

                {/* Order Summary Stacked Bar Chart Section */}
                <View style={styles.chartContainer}>
                     <Text style={styles.chartTitle}>📦 Order Status Summary</Text>
                     <View style={styles.chartRenderArea}>
                        {loadingOrders ? (
                            <ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} />
                        ) : errorOrders ? (
                            <Text style={styles.errorText}>{errorOrders}</Text>
                        ) : (totalOrders > 0 || pendingOrders > 0 || activeOrders > 0 || deliveredOrders > 0 || shippedOrders > 0 || cancelledOrders > 0) ? (
                            <StackedBarChart
                                style={styles.chartStyle}
                                data={stackedOrderData} // Uses the RED bars data
                                width={screenWidth - 40}
                                height={240}
                                chartConfig={stackedBarChartConfig}
                                hideLegend={false}
                                fromZero={true}
                            />
                         ) : (
                            <Text style={styles.noDataText}>No order data found.</Text>
                         )}
                    </View>

                    {/* *** UPDATED: Display live counts below the chart in TWO ROWS *** */}
                     {!loadingOrders && !errorOrders && (
                        <View style={styles.orderCountsMainContainer}>
                            {/* Row 1 */}
                            <View style={styles.orderCountsRow}>
                                <Text style={styles.orderCountText}>Pending: {pendingOrders}</Text>
                                <Text style={styles.orderCountText}>Active: {activeOrders}</Text>
                                <Text style={styles.orderCountText}>Shipped: {shippedOrders}</Text>
                            </View>
                            {/* Row 2 */}
                            <View style={styles.orderCountsRow}>
                                <Text style={styles.orderCountText}>Delivered: {deliveredOrders}</Text>
                                <Text style={styles.orderCountText}>Cancelled: {cancelledOrders}</Text>
                                <Text style={styles.orderCountText}>Total: {totalOrders}</Text>
                            </View>
                        </View>
                     )}
                     {/* *** END OF UPDATED ORDER COUNTS SECTION *** */}
                </View>

                {/* Total Sales Bar Chart (Static Example) */}
                <View style={styles.chartContainer}>
                     <Text style={styles.chartTitle}>💰 Total Sales (Example)</Text>
                     <View style={styles.chartRenderArea}>
                         <BarChart
                             data={{
                                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                                datasets: [{ data: [500, 1000, 750, 1200, 2000] }],
                             }}
                             width={screenWidth - 40} height={240} yAxisLabel="$"
                             chartConfig={chartConfigBase} // Uses the base blue config
                             verticalLabelRotation={Platform.OS === 'android' ? 30 : 0}
                             style={styles.chartStyle} fromZero={true}
                         />
                     </View>
                </View>
            </ScrollView>

            {/* Drawer Overlay */}
            {isDrawerOpen && (
                <View style={styles.drawerOverlay}>
                    <AdminCustomDrawer navigation={navigation} closeDrawer={() => setIsDrawerOpen(false)} />
                </View>
            )}
        </View>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F5F5F5', },
    headerBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 15, height: 63, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, },
    logo: { width: 70, height: 55, resizeMode: 'contain', },
    profileIconContainer: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'white', justifyContent: 'center', alignItems: 'center', backgroundColor: '#D32F2F', overflow: 'hidden', }, // Slightly darker red for contrast
    profileImageStyle: { width: '100%', height: '100%', borderRadius: 25, },
    drawerOverlay: { position: 'absolute', top: 0, bottom: 0, right: 0, left: 0, zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.3)', },
    container: { flex: 1, },
    scrollContentContainer: { padding: 15, paddingBottom: 30, },
    chartTitle: { fontSize: 18, fontWeight: '600', color: '#444', textAlign: 'center', marginBottom: 10, paddingHorizontal: 10, },
    totalUsersText: { fontSize: 16, fontWeight: '500', color: '#666', textAlign: 'center', marginBottom: 10, },
    chartContainer: { backgroundColor: '#ffffff', borderRadius: 10, paddingVertical: 15, paddingHorizontal: 10, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.23, shadowRadius: 2.62, elevation: 4, },
    chartRenderArea: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 240, }, // Adjusted minHeight slightly for bar charts
    chartStyle: { marginVertical: 8, borderRadius: 10, },
    errorText: { color: '#D8000C', backgroundColor: '#FFD2D2', padding: 10, borderRadius: 5, textAlign: 'center', fontSize: 15, marginHorizontal: 10, },
    noDataText: { color: '#555', textAlign: 'center', fontSize: 15, fontStyle: 'italic', marginTop: 20, marginBottom: 20 },
    // --- UPDATED Styles for Order Counts ---
    orderCountsMainContainer: {
        marginTop: 15,
        paddingHorizontal: 5,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 10,
    },
    orderCountsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
        width: '100%',
    },
    orderCountText: {
        fontSize: 13,
        color: '#555',
        fontWeight: '500',
        textAlign: 'center',
        flex: 1, // Allows text items to space out evenly
        // marginHorizontal: 3, // Optional: Add small horizontal margin if needed
    },
    // --- END of UPDATED Styles ---
});