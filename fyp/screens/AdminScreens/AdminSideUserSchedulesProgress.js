// AdminSideUserSchedulesProgress.js
// Lists BNPL, Fixed Duration, AND Mixed Orders for Admin - ** STATUS FILTERING (Active/Completed) **

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet, Text, View, FlatList, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, RefreshControl,
    Image, TextInput, ScrollView, Dimensions, Platform
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    getFirestore, collection, getDocs, query, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // **** Ensure this path is correct ****
import { format, isValid } from 'date-fns';

// --- Constants --- (Keep Existing Constants like colors, types etc.)
const { width } = Dimensions.get('window');
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F5F5F5';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000';
const InstallmentColor = '#4CAF50';
const FixedDurationColor = '#2196F3';
const MixedColor = '#9C27B0';
const PlaceholderBgColor = '#F0F0F0';
const ORDERS_COLLECTION = 'orders';
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const MIXED_TYPE = 'Mixed';
const INSTALLMENT_LABEL = 'Installment';
const DETAIL_SCREEN_ROUTE_NAME = 'UserSchedulesProgressDetails';
const placeholderImagePath = require('../../assets/p3.jpg'); // **** ADJUST PATH ****
// Status constants for filtering logic clarity
const STATUS_ACTIVE = 'Active';
const STATUS_DELIVERED = 'Delivered';
const PAYMENT_STATUS_PAID = 'Paid';


// --- *** UPDATED Filters for Header *** ---
const SCHEDULE_FILTERS = [
  { displayName: 'All ', filterValue: 'All' },
  { displayName: 'Active Schedules', filterValue: STATUS_ACTIVE },
  { displayName: 'Completed Schedules', filterValue: 'Completed' }, // Use 'Completed' for display/logic
];

// --- Helper Functions --- (Keep Existing Helpers)
const formatShortDate = (timestamp) => { /* ... same ... */
    let dateToFormat = null; if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); } else if (timestamp instanceof Date) { dateToFormat = timestamp; } else if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) {} } if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; }} return timestamp ? 'Invalid Date' : 'Pending Date';
};
const getStatusStyle = (status) => { /* ... same using styles below ... */
    const lowerStatus = status?.toLowerCase() || 'unknown'; switch (lowerStatus) { case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending; case 'processing': case 'partially paid': return styles.statusProcessing; case 'shipped': return styles.statusShipped; case 'delivered': return styles.statusDelivered; case 'active': return styles.statusActive; case 'cancelled': case 'rejected': return styles.statusCancelled; case 'paid': return styles.statusPaid; default: return styles.statusUnknown; }
};
const getPaymentMethodStyle = (type) => { /* ... same using styles below ... */
    const lowerType = type?.toLowerCase(); switch (lowerType) { case BNPL_TYPE.toLowerCase(): return styles.typeInstallment; case FIXED_TYPE.toLowerCase(): return styles.typeFixed; case MIXED_TYPE.toLowerCase(): return styles.typeMixed; default: return styles.typeUnknown; }
};
// --- End Helper Functions ---


// --- Main Component ---
export default function AdminSideUserSchedulesProgress() {
    // --- State and Hooks (Keep Existing) ---
    const navigation = useNavigation();
    const [allFetchedOrdersRaw, setAllFetchedOrdersRaw] = useState([]);
    const [scheduleRelatedOrders, setScheduleRelatedOrders] = useState([]); // Still holds only BNPL/Fixed/Mixed types
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('All'); // Default filter
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // --- Fetch Logic (Keep Existing - Still fetches all and pre-filters by type) ---
    const fetchAllOrders = useCallback(async () => {
        if (!refreshing) setLoading(true); setError(null); console.log("Fetching ALL orders (Admin Schedules View)..."); try { const q = query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc')); const querySnapshot = await getDocs(q); const fetchedOrders = []; querySnapshot.forEach((doc) => { const data = doc.data(); if (data && data.createdAt) { fetchedOrders.push({ id: doc.id, ...data }); } else { console.warn(`Skipping order ${doc.id}`); } }); setAllFetchedOrdersRaw(fetchedOrders); console.log(`Fetched ${fetchedOrders.length} total orders.`); const initialFiltered = fetchedOrders.filter(order => order.paymentMethod === BNPL_TYPE || order.paymentMethod === FIXED_TYPE || order.paymentMethod === MIXED_TYPE); setScheduleRelatedOrders(initialFiltered); console.log(`Initially filtered down to ${initialFiltered.length} schedule-related orders (BNPL/Fixed/Mixed).`); } catch (err) { console.error("Error fetching orders:", err); setError("Failed to load orders."); setAllFetchedOrdersRaw([]); setScheduleRelatedOrders([]); } finally { setLoading(false); setRefreshing(false); }
    }, [refreshing]);
    useFocusEffect(useCallback(() => { fetchAllOrders(); }, [fetchAllOrders]));

    // --- *** UPDATED Memoized Filtering for UI (Based on Status) *** ---
    const displayOrders = useMemo(() => {
        console.log(`Applying UI Filters. Search: "${searchQuery}", Filter: "${filter}" to ${scheduleRelatedOrders.length} schedule-related orders.`);
        return scheduleRelatedOrders.filter(order => {
            // 1. Check Search Query Match
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = (
                !searchQuery ||
                (order.userName?.toLowerCase().includes(searchLower)) ||
                (order.id.toLowerCase().includes(searchLower)) ||
                (order.orderNumber?.toLowerCase().includes(searchLower))
            );

            // 2. Check Status Filter Match
            let matchesFilter = false;
            const orderStatusLower = order.status?.toLowerCase();
            const paymentStatusLower = order.paymentStatus?.toLowerCase();

            if (filter === 'All') {
                matchesFilter = true; // Show all pre-filtered (BNPL/Fixed/Mixed) orders
            } else if (filter === STATUS_ACTIVE) {
                // Definition of Active Schedule: Status is 'Active' OR (Status is 'Delivered' AND Payment is NOT 'Paid')
                matchesFilter = (orderStatusLower === STATUS_ACTIVE.toLowerCase()) ||
                                (orderStatusLower === STATUS_DELIVERED.toLowerCase() && paymentStatusLower !== PAYMENT_STATUS_PAID.toLowerCase());
            } else if (filter === 'Completed') {
                // Definition of Completed Schedule: Payment Status is 'Paid'
                matchesFilter = paymentStatusLower === PAYMENT_STATUS_PAID.toLowerCase();
            }

            // Return true only if both search and filter match
            return matchesSearch && matchesFilter;
        });
    }, [scheduleRelatedOrders, searchQuery, filter]); // Dependencies for recalculation

    // --- Handlers (Keep Existing) ---
    const onRefresh = useCallback(() => { setRefreshing(true); fetchAllOrders(); }, [fetchAllOrders]);
    const handleOrderPress = (orderItem) => { if (!orderItem || !orderItem.id) return; navigation.navigate(DETAIL_SCREEN_ROUTE_NAME, { order: orderItem }); };
    const onSearchInputChange = (text) => { setSearchQuery(text); };
    const clearSearch = () => { setSearchQuery(''); };
    const onFilterChange = (newFilterValue) => { console.log("Filter changed to:", newFilterValue); setFilter(newFilterValue); };

    // --- Render Function for Each Order Item (Using previous V11 layout) ---
    const renderOrderItem = ({ item }) => {
        const displayId = item.orderNumber ? `#${item.orderNumber}` : `#${item.id.substring(0, 6).toUpperCase()}`;
        const orderStatus = item.status || 'Unknown';
        const paymentMethod = item.paymentMethod || 'Unknown';
        const paymentDisplayLabel = paymentMethod === MIXED_TYPE ? MIXED_TYPE : (paymentMethod === BNPL_TYPE ? INSTALLMENT_LABEL : paymentMethod);
        const firstItemImage = item.items && item.items.length > 0 ? item.items[0]?.image : null;
        const imageSource = firstItemImage ? { uri: firstItemImage } : placeholderImagePath;
        const orderDateFormatted = formatShortDate(item.createdAt || item.orderDate);

        return (
            <TouchableOpacity style={styles.itemContainerTouchable} onPress={() => handleOrderPress(item)} activeOpacity={0.8}>
                <View style={styles.itemContentRow}>
                    {/* Left: Image */}
                    <Image source={imageSource} style={styles.orderItemImage} defaultSource={placeholderImagePath}/>

                    {/* Center: Main Details */}
                    <View style={styles.mainDetailsColumn}>
                        <Text style={styles.customerNameText} numberOfLines={1}>{item.userName || 'N/A'}</Text>
                        <Text style={styles.orderIdentifierText} numberOfLines={1}>{displayId}</Text>
                        <Text style={styles.totalValueText} numberOfLines={1}>
                            {CURRENCY_SYMBOL} {(item.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Text>
                        {/* Payment Type Badge */}
                        <View style={styles.paymentTypeContainer}>
                            <View style={[styles.typeBadge, getPaymentMethodStyle(paymentMethod)]}>
                                <Text style={styles.typeText}>{paymentDisplayLabel}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Right: Status & Date */}
                    <View style={styles.rightDetailsContainer}>
                        {/* Status Badge */}
                        <View style={[styles.statusBadge, getStatusStyle(orderStatus)]}>
                            <Text style={styles.statusText}>{orderStatus}</Text>
                        </View>
                        {/* Date Text */}
                        <Text style={styles.dateTextRight}>{orderDateFormatted}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // --- Loading / Error / Empty States (Keep Existing) ---
    if (loading && displayOrders.length === 0 && !refreshing) { /* ... loading indicator ... */ return (<SafeAreaView style={styles.centeredContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.loadingText}>Loading Orders...</Text></SafeAreaView>); }
    if (error && displayOrders.length === 0 && !loading) { /* ... error message ... */ return (<SafeAreaView style={styles.centeredContainer}><Text style={styles.errorTextTitle}>Error Loading Orders</Text><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={fetchAllOrders} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></SafeAreaView>); }

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={AccentColor} />
            {/* Header Section */}
            <View style={styles.headerContainer}>
                {/* Search Bar */}
                <View style={styles.searchBar}>
                     <MaterialCommunityIcons name="magnify" size={22} color={AccentColor} style={styles.searchIcon} />
                     <TextInput style={styles.searchInput} placeholder="Search User or Order ID..." placeholderTextColor="#888" value={searchQuery} onChangeText={onSearchInputChange} returnKeyType="search" autoCapitalize="none" autoCorrect={false}/>
                     {searchQuery.length > 0 && (<TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}><MaterialCommunityIcons name="close-circle" size={20} color={AccentColor} /></TouchableOpacity>)}
                </View>
                {/* Filter Buttons (Using Updated SCHEDULE_FILTERS) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                     {SCHEDULE_FILTERS.map(filterItem => (
                         <TouchableOpacity
                             key={filterItem.filterValue}
                             style={[ styles.filterButton, filter === filterItem.filterValue && styles.activeFilter ]}
                             onPress={() => onFilterChange(filterItem.filterValue)}
                         >
                            <Text style={[ styles.filterText, filter === filterItem.filterValue && styles.activeFilterText ]}>
                                {filterItem.displayName}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
            {/* Error Banner */}
            {error && displayOrders.length > 0 && ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {error}</Text></View> )}
            {/* Order List */}
            <FlatList
                data={displayOrders} // Uses the updated filtered list
                renderItem={renderOrderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={ !loading && !error ? ( <View style={styles.emptyView}><MaterialCommunityIcons name="clipboard-text-outline" size={50} color="#ccc"/><Text style={styles.emptyText}>No schedules match your criteria.</Text>{scheduleRelatedOrders.length > 0 && ( <Text style={styles.emptyTextDetail}>({scheduleRelatedOrders.length} total schedules available)</Text>)}</View> ) : null } // Updated empty text
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AccentColor]} tintColor={AccentColor} /> }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        </SafeAreaView>
    );
}

// --- Styles --- (Using styles from previous V11 update)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    // Header Styles
    headerContainer: {
        backgroundColor: AccentColor,
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 15,
        paddingHorizontal: 15,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
        marginBottom: 0, // No margin below header
    },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 50, paddingHorizontal: 15, height: 45, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, marginBottom: 12, },
    searchIcon: { marginRight: 10, },
    searchInput: { flex: 1, fontSize: 15, color: '#333', },
    clearSearchButton: { padding: 5, marginLeft: 5, },
    filterScroll: { marginTop: 3, },
    filterButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: AccentColor, borderWidth: 1, borderColor: '#FFFFFF', marginRight: 10, justifyContent: 'center', alignItems: 'center', height: 34, },
    filterText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', },
    activeFilter: { backgroundColor: '#000000', borderColor: '#000000', },
    activeFilterText: { color: '#FFFFFF', fontWeight: 'bold', },

    // List Styles
    listContainer: { paddingBottom: 15, paddingTop: 0 }, // No paddingTop
    itemContainerTouchable: { backgroundColor: AppBackgroundColor },
    itemContentRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 15,
        alignItems: 'center'
    },
    separator: { height: 1, backgroundColor: '#EEEEEE', marginHorizontal: 15 },
    orderItemImage: {
        width: 55,
        height: 55,
        borderRadius: 8,
        marginRight: 15,
        backgroundColor: PlaceholderBgColor
    },
    mainDetailsColumn: {
        flex: 1,
        justifyContent: 'center',
        marginRight: 10,
    },
    customerNameText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: TextColorPrimary,
        marginBottom: 3,
    },
    orderIdentifierText: {
        fontSize: 13,
        color: TextColorSecondary,
        marginBottom: 4,
    },
    totalValueText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: AccentColor, // Red price
        marginTop: 2,
        marginBottom: 4,
    },
    paymentTypeContainer: {
        alignItems: 'flex-start',
        marginTop: 5,
    },
    typeBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 10
    },
    typeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff'
    },
    rightDetailsContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center', // Center vertically
        paddingLeft: 5,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 15,
        marginBottom: 0, // No margin below status
    },
    statusText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 11
    },
    dateTextRight: {
        fontSize: 11,
        color: TextColorSecondary,
        marginTop: 4, // Position below centered status
    },

    // Loading, Error, Empty Styles
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: TextColorSecondary },
    errorTextTitle: { fontSize: 18, fontWeight: 'bold', color: AccentColor, textAlign: 'center', marginBottom: 10 },
    errorText: { color: AccentColor, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
    emptyText: { textAlign: 'center', fontSize: 16, color: TextColorSecondary, marginTop: 15 },
    emptyTextDetail: { color: TextColorSecondary, fontSize: 12, textAlign: 'center', marginTop: 5 },
    retryButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6, marginTop: 10 },
    retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#FFCC80' },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },

    // --- Badge Colors (Keep Existing) ---
    statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusActive: { backgroundColor: '#29B6F6' }, statusCancelled: { backgroundColor: '#EF5350' }, statusPaid: { backgroundColor: '#4CAF50' }, statusUnknown: { backgroundColor: '#BDBDBD' },
    typeInstallment: { backgroundColor: InstallmentColor }, typeFixed: { backgroundColor: FixedDurationColor }, typeMixed: { backgroundColor: MixedColor }, typeUnknown: { backgroundColor: TextColorSecondary },
});