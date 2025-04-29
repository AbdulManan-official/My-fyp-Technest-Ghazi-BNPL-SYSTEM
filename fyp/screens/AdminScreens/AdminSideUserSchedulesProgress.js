// AdminSideUserSchedulesProgress.js - v13 - OrderScreen Style Indicator Applied (COMPLETE & CHECKED)
// Lists BNPL, Fixed Duration, AND Mixed Orders for Admin - STATUS FILTERING (Active/Completed).
// Uses OrderScreen/MyOrders item layout with subtle text indicator (Installment/Fixed/Mixed).

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet, Text, View, FlatList, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, RefreshControl,
    Image, TextInput, ScrollView, Dimensions, Platform, Alert
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
// Using MaterialCommunityIcons for header, list item icons, and indicator icon
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    getFirestore, collection, getDocs, query, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // **** Ensure this path is correct ****
import { format, isValid } from 'date-fns';

// --- Constants ---
const { width } = Dimensions.get('window');
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F5F5F5';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000'; // Header, Status Badges etc.

// Indicator Colors (like OrderScreen)
const BnplIndicatorBgColor = 'rgba(0, 86, 179, 0.1)';
const BnplIndicatorTextColor = '#0056b3';

// Status Badge Colors (Keep these)
const PendingColor = '#FFA726';
const ProcessingColor = '#42A5F5';
const ShippedColor = '#66BB6A';
const DeliveredColor = '#78909C';
const ActiveColor = '#29B6F6';
const CancelledColor = '#EF5350';
const PaidColor = '#4CAF50';
const UnknownColor = '#BDBDBD';

const PlaceholderBgColor = '#F0F0F0';
const ORDERS_COLLECTION = 'orders';
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const MIXED_TYPE = 'Mixed';
const INSTALLMENT_LABEL = 'Installment'; // Still needed for the text logic
const DETAIL_SCREEN_ROUTE_NAME = 'UserSchedulesProgressDetails';
const placeholderImagePath = require('../../assets/p3.jpg'); // **** ADJUST PATH ****
// Status constants for filtering logic clarity
const STATUS_ACTIVE = 'Active';
const STATUS_DELIVERED = 'Delivered';
const PAYMENT_STATUS_PAID = 'Paid';

// Lowercase versions for checking in listener
const SCHEDULE_PAYMENT_METHODS_LOWER = [BNPL_TYPE.toLowerCase(), FIXED_TYPE.toLowerCase(), MIXED_TYPE.toLowerCase()];

// --- Filters for Header ---
const SCHEDULE_FILTERS = [
  { displayName: 'All', filterValue: 'All' },
  { displayName: 'Active', filterValue: STATUS_ACTIVE },
  { displayName: 'Completed', filterValue: 'Completed' },
];

// --- Helper Functions ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    else if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) { } }
    if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; } }
    return timestamp ? 'Invalid Date' : 'Pending Date';
};

const getStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
        case 'processing': case 'partially paid': return styles.statusProcessing;
        case 'shipped': return styles.statusShipped;
        case 'delivered': return styles.statusDelivered;
        case 'active': return styles.statusActive;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        case 'paid': return styles.statusPaid;
        default: return styles.statusUnknown;
    }
};
// getPaymentMethodStyle is REMOVED
// --- End Helper Functions ---

// --- Main Component ---
export default function AdminSideUserSchedulesProgress() {
    // --- State and Hooks ---
    const navigation = useNavigation();
    const [allFetchedOrdersRaw, setAllFetchedOrdersRaw] = useState([]);
    const [scheduleRelatedOrders, setScheduleRelatedOrders] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // --- Fetch Logic ---
    const fetchAllOrders = useCallback(async () => {
        if (!refreshing) setLoading(true); setError(null);
        console.log("Fetching ALL orders (Admin Schedules View)...");
        try {
            const q = query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedOrders = querySnapshot.docs.map(doc => {
                 const data = doc.data();
                 if (!data || !(data.createdAt instanceof Timestamp)) {
                     console.warn(`[AdminSchedules] Skipping order ${doc.id}: Invalid data/createdAt.`);
                     return null;
                 }
                 // Calculate isScheduledPayment flag
                 const paymentMethodLower = data.paymentMethod?.toLowerCase() ?? '';
                 const isScheduledPayment = SCHEDULE_PAYMENT_METHODS_LOWER.includes(paymentMethodLower);

                 return {
                    id: doc.id,
                    isScheduledPayment: isScheduledPayment, // Include flag
                    ...data // Spread the rest of the data
                 };
            }).filter(order => order !== null); // Filter out skipped orders

            setAllFetchedOrdersRaw(fetchedOrders);
            console.log(`Fetched ${fetchedOrders.length} total orders.`);

            // Pre-filter to only *initially* store BNPL, Fixed, and Mixed Orders in the display state
            const initialFiltered = fetchedOrders.filter(order =>
                order.isScheduledPayment // Use the calculated flag
            );

            setScheduleRelatedOrders(initialFiltered);
            console.log(`Initially filtered down to ${initialFiltered.length} schedule-related orders.`);
        } catch (err) {
            console.error("Error fetching orders:", err); setError("Failed to load orders.");
            setAllFetchedOrdersRaw([]); setScheduleRelatedOrders([]);
        } finally { setLoading(false); setRefreshing(false); }
    }, [refreshing]);

    useFocusEffect(useCallback(() => { fetchAllOrders(); }, [fetchAllOrders]));

    // --- Memoized Filtering for UI (Based on Status) ---
    const displayOrders = useMemo(() => {
        console.log(`Applying UI Filters. Search: "${searchQuery}", Filter: "${filter}" to ${scheduleRelatedOrders.length} schedule-related orders.`);
        let filteredOrders = [...scheduleRelatedOrders];
        // 1. Search Filter
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            filteredOrders = filteredOrders.filter(order =>
                (order.userName?.toLowerCase().includes(searchLower)) ||
                (order.id.toLowerCase().includes(searchLower)) ||
                (order.orderNumber?.toLowerCase().includes(searchLower))
            );
        }
        // 2. Status Filter
        if (filter !== 'All') {
            const filterLower = filter.toLowerCase();
            filteredOrders = filteredOrders.filter(order => {
                const orderStatusLower = order.status?.toLowerCase();
                const paymentStatusLower = order.paymentStatus?.toLowerCase();
                if (filterLower === STATUS_ACTIVE.toLowerCase()) {
                    return (orderStatusLower === STATUS_ACTIVE.toLowerCase()) ||
                           (orderStatusLower === STATUS_DELIVERED.toLowerCase() && paymentStatusLower !== PAYMENT_STATUS_PAID.toLowerCase());
                } else if (filterLower === 'completed') {
                    return paymentStatusLower === PAYMENT_STATUS_PAID.toLowerCase();
                }
                return true; // Should not be reached with current logic
            });
        }
        return filteredOrders;
    }, [scheduleRelatedOrders, searchQuery, filter]);


    // --- Handlers ---
    const onRefresh = useCallback(() => { setRefreshing(true); fetchAllOrders(); }, [fetchAllOrders]);
    const handleOrderPress = (orderItem) => { if (!orderItem || !orderItem.id) return; navigation.navigate(DETAIL_SCREEN_ROUTE_NAME, { order: orderItem }); };
    const onSearchInputChange = (text) => { setSearchQuery(text); };
    const clearSearch = () => { setSearchQuery(''); };
    const onFilterChange = (newFilterValue) => { setFilter(newFilterValue); };

    // --- Render Function (OrderScreen Style Indicator) ---
    const renderOrderItem = ({ item }) => {
        const displayId = item.orderNumber ? `#${item.orderNumber}` : `#${item.id.substring(0, 6).toUpperCase()}`;
        const orderStatus = item.status || 'Unknown';
        const paymentMethod = item.paymentMethod || 'Unknown';
        // Calculate display label for indicator text
        const paymentDisplayLabel = paymentMethod === MIXED_TYPE ? MIXED_TYPE : (paymentMethod === BNPL_TYPE ? INSTALLMENT_LABEL : paymentMethod);
        const firstItemImage = item.items?.[0]?.image || null;
        const imageSource = firstItemImage ? { uri: firstItemImage } : placeholderImagePath;
        const orderDateFormatted = formatShortDate(item.createdAt || item.orderDate);

        if (!item || !item.id) return null; // Basic check

        return (
            <TouchableOpacity style={styles.orderContainer} onPress={() => handleOrderPress(item)} activeOpacity={0.8}>
                 <View style={styles.orderRow}>
                     {/* Left: Image */}
                     <Image source={imageSource} style={styles.previewImage} defaultSource={placeholderImagePath} />
                     {/* Center: Main Details */}
                     <View style={styles.middleContent}>
                         <Text style={styles.orderName} numberOfLines={1}>{item.userName || 'N/A'}</Text>
                         <Text style={styles.orderIdText} numberOfLines={1}>{displayId}</Text>
                         {/* Indicator */}
                         {item.isScheduledPayment && ( // Use the flag calculated during fetch
                             <View style={styles.bnplIndicatorContainer}>
                                 <MaterialCommunityIcons name="credit-card-clock-outline" size={12} color={BnplIndicatorTextColor} style={styles.bnplIcon} />
                                 <Text style={styles.bnplIndicatorText} numberOfLines={1}>
                                     {paymentDisplayLabel}
                                 </Text>
                             </View>
                         )}
                         <Text style={styles.orderPriceText} numberOfLines={1}>
                             {CURRENCY_SYMBOL} {(item.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                         </Text>
                     </View>
                     {/* Right: Status & Date */}
                     <View style={styles.rightContent}>
                         <View style={[styles.statusBadge, getStatusStyle(orderStatus)]}>
                             <Text style={styles.statusText}>{orderStatus}</Text>
                         </View>
                         <Text style={styles.orderDateText}>{orderDateFormatted}</Text>
                     </View>
                 </View>
             </TouchableOpacity>
        );
    };

    // --- Loading / Error States ---
    if (loading && displayOrders.length === 0 && !refreshing) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <ActivityIndicator size="large" color={AccentColor} />
                <Text style={styles.loadingText}>Loading Schedules...</Text>
            </SafeAreaView>
        );
    }
    if (error && displayOrders.length === 0 && !loading) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <Text style={styles.errorTextTitle}>Error Loading Schedules</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={fetchAllOrders} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={AccentColor} />
            {/* Header Section */}
            <View style={styles.headerContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={22} color={AccentColor} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search User or Order ID..."
                        placeholderTextColor="#888"
                        value={searchQuery}
                        onChangeText={onSearchInputChange}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                            <MaterialCommunityIcons name="close-circle" size={20} color={AccentColor} />
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {SCHEDULE_FILTERS.map(filterItem => (
                        <TouchableOpacity
                            key={filterItem.filterValue}
                            style={[styles.filterButton, filter === filterItem.filterValue && styles.activeFilter]}
                            onPress={() => onFilterChange(filterItem.filterValue)} >
                            <Text style={[styles.filterText, filter === filterItem.filterValue && styles.activeFilterText]}>
                                {filterItem.displayName}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
            {/* Error Banner */}
            {error && displayOrders.length > 0 && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>⚠️ {error}</Text>
                </View>
            )}
            {/* Order List */}
            <FlatList
                data={displayOrders}
                renderItem={renderOrderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.flatListContainer, displayOrders.length === 0 && styles.emptyListContainer]}
                // *** CORRECTED ListEmptyComponent ***
                ListEmptyComponent={
                    !loading && !error ? ( // Show only if not loading and no error
                        <View style={styles.emptyView}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={50} color="#ccc" />
                            <Text style={styles.emptyText}>
                                {searchQuery || filter !== 'All' ? "No schedules match criteria." : "No schedules found."}
                            </Text>
                            {/* Show total only if filtering caused empty state and there *are* schedules originally */}
                            {scheduleRelatedOrders.length > 0 && (searchQuery || filter !== 'All') && (
                                <Text style={styles.emptyTextDetail}>
                                    ({scheduleRelatedOrders.length} total schedules available)
                                </Text>
                            )}
                        </View>
                    ) : null // Don't show empty state while loading or if there's an error (handled above)
                }
                // *** END CORRECTION ***
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AccentColor]} tintColor={AccentColor} />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        </SafeAreaView>
    );
}

// --- Styles (Adopted from OrderScreen/MyOrders Item Style) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    // Header Styles
    headerContainer: { backgroundColor: AccentColor, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, marginBottom: 0, },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 50, paddingHorizontal: 15, height: 45, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, marginBottom: 12, },
    searchIcon: { marginRight: 10, },
    searchInput: { flex: 1, fontSize: 15, color: '#333', },
    clearSearchButton: { padding: 5, marginLeft: 5, },
    filterScroll: { marginTop: 3, },
    filterButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: AccentColor, borderWidth: 1, borderColor: '#FFFFFF', marginRight: 10, justifyContent: 'center', alignItems: 'center', height: 34, },
    filterText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', },
    activeFilter: { backgroundColor: '#000000', borderColor: '#000000', },
    activeFilterText: { color: '#FFFFFF', fontWeight: 'bold', },

    // --- List & Item Styles ---
    flatListContainer: { paddingBottom: 15, paddingTop: 0 },
    emptyListContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    orderContainer: { backgroundColor: AppBackgroundColor, },
    orderRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 15, alignItems: 'center' },
    separator: { height: 1, backgroundColor: '#EEEEEE', marginHorizontal: 15 },
    previewImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: PlaceholderBgColor },
    middleContent: { flex: 1, justifyContent: 'center', marginRight: 10, },
    orderName: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 2, },
    orderIdText: { fontSize: 12, color: TextColorSecondary, marginBottom: 4, },
    // Indicator Styles
    bnplIndicatorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 0, marginBottom: 5, alignSelf: 'flex-start', backgroundColor: BnplIndicatorBgColor, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, maxWidth: '90%' },
    bnplIcon: { marginRight: 4, },
    bnplIndicatorText: { fontSize: 11, fontWeight: '600', color: BnplIndicatorTextColor, flexShrink: 1 },
    // Price Text Style
    orderPriceText: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, },
    // Right Content Styles
    rightContent: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 5, minWidth: 85, },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15, marginBottom: 4, },
    statusText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
    orderDateText: { fontSize: 11, color: TextColorSecondary, },

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

    // Status Badge Colors
    statusPending: { backgroundColor: PendingColor }, statusProcessing: { backgroundColor: ProcessingColor }, statusShipped: { backgroundColor: ShippedColor }, statusDelivered: { backgroundColor: DeliveredColor }, statusActive: { backgroundColor: ActiveColor }, statusCancelled: { backgroundColor: CancelledColor }, statusPaid: { backgroundColor: PaidColor }, statusUnknown: { backgroundColor: UnknownColor },
});