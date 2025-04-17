import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/FontAwesome';
import AdminCustomDrawer from './AdminCustomDrawer'; // ✅ Update path if needed

// Import Firebase Firestore functions
import { getFirestore, collection, getDocs, FirestoreError } from 'firebase/firestore';
import { app } from '../../firebaseConfig'; // Assuming firebase config is exported from here

const db = getFirestore(app);
console.log('Firestore Initialized:', db ? 'Yes' : 'No');

const screenWidth = Dimensions.get('window').width;

// --- Chart Configurations ---
const chartConfigBase = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 10 },
    propsForDots: { r: '6', strokeWidth: '2', stroke: '#36A2EB' },
};

const pieChartConfig = {
    ...chartConfigBase,
    color: (opacity = 1, index) => {
        // Ensure colors match the data array order in usersData state
        const colors = ['#36A2EB', '#FF6384']; // Verified (Blue), Unverified (Red)
        return colors[index % colors.length] || `rgba(200, 200, 200, ${opacity})`; // Fallback grey
    },
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
};


export default function AdminHomeScreen({ navigation }) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // --- State for User Chart Data ---
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [errorUsers, setErrorUsers] = useState(null);
    const [totalUsers, setTotalUsers] = useState(0);
    const [usersData, setUsersData] = useState([
        {
            name: 'Verified',
            population: 0,
            color: '#36A2EB', // Blue
            legendFontColor: '#333',
            legendFontSize: 14,
        },
        {
            name: 'Unverified',
            population: 0,
            color: '#FF6384', // Red
            legendFontColor: '#333',
            legendFontSize: 14,
        },
    ]);

    // --- Fetch User Data Effect ---
    useEffect(() => {
        console.log('User data fetch effect starting...');
        const fetchUsersData = async () => {
            setLoadingUsers(true);
            setErrorUsers(null);
            setTotalUsers(0);
            try {
                console.log("Attempting to fetch users from 'Users' collection...");
                const usersCol = collection(db, 'Users'); // Collection Name: Users
                const userSnapshot = await getDocs(usersCol);
                console.log(`Fetched ${userSnapshot.size} user documents from 'Users'.`);

                setTotalUsers(userSnapshot.size); // Set total count
                console.log(`Total users count set to: ${userSnapshot.size}`);

                if (userSnapshot.empty) {
                   console.warn("No documents found in the 'Users' collection.");
                }

                let verifiedCount = 0;
                let unverifiedCount = 0;

                userSnapshot.forEach((doc) => {
                    const userData = doc.data();
                    const status = userData.verificationStatus; // Field Name: verificationStatus

                    // Log the first document's data structure for debugging
                     if (verifiedCount === 0 && unverifiedCount === 0 && userData) {
                        console.log("First user document data:", JSON.stringify(userData));
                        console.log(`Checking field: verificationStatus = ${status}`);
                     }

                    // Check for 'verified' OR 'Verified'
                    if (status === 'verified' || status === 'Verified') {
                        verifiedCount++;
                    } else {
                        unverifiedCount++;
                    }
                });

                console.log(`Processed counts - Verified: ${verifiedCount}, Unverified: ${unverifiedCount}`);

                const newUsersData = [
                    { ...usersData[0], population: verifiedCount },
                    { ...usersData[1], population: unverifiedCount },
                ];
                setUsersData(newUsersData);
                console.log('User verification status state updated.');

            } catch (err) {
                console.error("!!! Firebase Fetch Error (Users Collection):", err);
                 let errorMessage = "Failed to load user data. Please check connection or configuration.";
                 if (err instanceof FirestoreError) {
                    errorMessage += ` (Code: ${err.code})`;
                    if (err.code === 'permission-denied') {
                        errorMessage = "Permission denied. Check Firestore security rules for the 'Users' collection.";
                    } else if (err.code === 'unauthenticated') {
                         errorMessage = "Authentication error. Please log in again.";
                    }
                } else if (err.message) {
                    errorMessage += ` (${err.message})`;
                }
                setErrorUsers(errorMessage);
            } finally {
                setLoadingUsers(false);
                console.log('User data fetch attempt finished. Loading set to false.');
            }
        };

        fetchUsersData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Runs once on mount

    return (
        <View style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.headerBar}>
                <Image source={require('../../assets/pic2.jpg')} style={styles.logo} />
                <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}>
                        <Icon name="user" size={24} color="white" />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContentContainer}
            >
                {/* "Admin Dashboard" Header Removed */}
                {/* <Text style={styles.header}>📊 Admin Dashboard</Text> */}

                {/* --- User Status Pie Chart Section --- */}
                {/* Container now holds title, count, and chart/loader/error */}
                <View style={styles.chartContainer}>
                    {/* Title inside container */}
                    <Text style={styles.chartTitle}>👤 User Verification Status</Text>

                    {/* Total Users Count inside container (conditional) */}
                    {!loadingUsers && !errorUsers && (
                        <Text style={styles.totalUsersText}>
                            Total Users: {totalUsers}
                        </Text>
                    )}

                    {/* Chart/Loader/Error Area */}
                    <View style={styles.chartRenderArea}>
                        {loadingUsers ? (
                            <ActivityIndicator size="large" color="red" />
                        ) : errorUsers ? (
                            <Text style={styles.errorText}>{errorUsers}</Text>
                        ) : (
                            usersData.some(item => item.population > 0) || totalUsers > 0 ? (
                                <PieChart
                                    data={usersData.filter(item => item.population > 0)} // Filter slices with 0
                                    width={screenWidth - 60} // Adjust width considering container padding
                                    height={180} // Can reduce height slightly if title/count takes space
                                    chartConfig={pieChartConfig}
                                    accessor="population"
                                    backgroundColor="transparent"
                                    paddingLeft="15"
                                    center={[10, 0]} // May need adjustment
                                    // absolute
                                />
                            ) : (
                                <Text style={styles.noDataText}>No user status data available.</Text>
                            )
                        )}
                    </View>
                </View>

                {/* --- Total Orders Chart (Static Data) --- */}
                <Text style={styles.chartTitleOutside}>📦 Total Orders</Text>
                <View style={styles.chartContainer}>
                    {/* No title inside this one */}
                    <LineChart
                        data={{
                            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                            datasets: [{ data: [20, 45, 28, 80, 99] }],
                        }}
                        width={screenWidth - 30}
                        height={220}
                        chartConfig={chartConfigBase}
                        bezier
                        style={styles.chartStyle}
                    />
                </View>

                {/* --- Total Sales Bar Chart (Static Data) --- */}
                <Text style={styles.chartTitleOutside}>💰 Total Sales (USD)</Text>
                 <View style={styles.chartContainer}>
                     {/* No title inside this one */}
                    <BarChart
                        data={{
                            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                            datasets: [{ data: [500, 1000, 750, 1200, 2000] }],
                        }}
                        width={screenWidth - 30}
                        height={240}
                        yAxisLabel="$"
                        chartConfig={chartConfigBase}
                        verticalLabelRotation={Platform.OS === 'android' ? 30 : 0}
                        style={styles.chartStyle}
                        fromZero={true}
                    />
                </View>

            </ScrollView>

            {/* Drawer Overlay */}
            {isDrawerOpen && (
                <View style={styles.drawerOverlay}>
                    <AdminCustomDrawer
                        navigation={navigation}
                        closeDrawer={() => setIsDrawerOpen(false)}
                    />
                </View>
            )}
        </View>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FF0000', // Red header bar color
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    logo: {
        width: 90,
        height: 30,
        resizeMode: 'contain',
    },
    profileIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    drawerOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        left: 0,
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    container: {
        flex: 1,
    },
    scrollContentContainer: {
       padding: 15,
       paddingBottom: 30,
    },
    // header: { // Removed - was for "Admin Dashboard"
    //     fontSize: 24,
    //     fontWeight: 'bold',
    //     textAlign: 'center',
    //     marginBottom: 20,
    //     color: '#333',
    // },
    // Title style when INSIDE the container
    chartTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#444',
        textAlign: 'center', // Center title within container
        marginBottom: 5, // Space below title, before total count
        paddingHorizontal: 10, // Padding if text is long
    },
    // Title style when OUTSIDE the container (for other charts)
    chartTitleOutside: {
        fontSize: 18,
        fontWeight: '600',
        marginVertical: 10,
        marginTop: 15,
        color: '#444',
    },
    // Style for the Total Users text INSIDE container
    totalUsersText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#666',
        textAlign: 'center',
        marginBottom: 10, // Space below count, before chart area
    },
    // Container for each chart section
    chartContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        paddingVertical: 15, // Vertical padding for the container
        paddingHorizontal: 10, // Horizontal padding for the container
        marginBottom: 20,
        minHeight: 240, // Keep min height
        // alignItems: 'center', // Center items like title/count horizontally
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
        // justifyContent is not needed here if content flows naturally top-down
    },
    // Specific area for chart/loader/error to center these items
    chartRenderArea: {
        flex: 1, // Take remaining space in container
        justifyContent: 'center', // Center loader/error vertically
        alignItems: 'center', // Center loader/error horizontally
        minHeight: 180, // Min height for the chart itself
    },
    // Specific style for the chart component itself (if needed)
    chartStyle: {
       // marginVertical: 8, // Example
    },
    errorText: {
        color: '#D8000C',
        backgroundColor: '#FFD2D2',
        padding: 10,
        borderRadius: 5,
        textAlign: 'center',
        fontSize: 15,
        marginHorizontal: 10,
    },
     noDataText: {
        color: '#555',
        textAlign: 'center',
        fontSize: 15,
        fontStyle: 'italic',
    }
});