import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/FontAwesome';
import AdminCustomDrawer from './AdminCustomDrawer'; // ✅ Update path if needed

const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: { borderRadius: 10 },
  propsForDots: { r: '6', strokeWidth: '2', stroke: '#36A2EB' },
};

export default function AdminHomeScreen({ navigation }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      {/* ✅ Header with logo & user icon */}
      <View style={styles.headerBar}>
        <Image source={require('../../assets/pic2.jpg')} style={styles.logo} />
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
          <View style={styles.profileIconContainer}>
            <Icon name="user" size={24} color="white" />
          </View>
        </TouchableOpacity>
      </View>

      {/* ✅ Main Content */}
      <ScrollView style={styles.container}>
        <Text style={styles.header}>📊 Admin Dashboard</Text>

        {/* Total Orders Chart */}
        <Text style={styles.chartTitle}>📦 Total Orders</Text>
        <LineChart
          data={{
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [{ data: [20, 45, 28, 80, 99] }],
          }}
          width={Dimensions.get('window').width - 30}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />

        {/* Total Sales Bar Chart */}
        <Text style={styles.chartTitle}>💰 Total Sales (USD)</Text>
        <BarChart
          data={{
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [{ data: [500, 1000, 750, 1200, 2000] }],
          }}
          width={Dimensions.get('window').width - 30}
          height={220}
          yAxisLabel="$"
          chartConfig={chartConfig}
          verticalLabelRotation={30}
          style={styles.chart}
        />

        {/* Active Users Pie Chart */}
        <Text style={styles.chartTitle}>👤 Active Users</Text>
        <PieChart
          data={[
            {
              name: 'Active',
              population: 400,
              color: '#36A2EB',
              legendFontColor: '#333',
              legendFontSize: 14,
            },
            {
              name: 'Inactive',
              population: 100,
              color: '#FF6384',
              legendFontColor: '#333',
              legendFontSize: 14,
            },
          ]}
          width={Dimensions.get('window').width - 30}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
      </ScrollView>

      {/* ✅ Drawer Overlay */}
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

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FF0000',
    padding: 10,
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
    backgroundColor: '#F5F5F5',
    padding: 15,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  chart: {
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: '#FFF',
    padding: 10,
    elevation: 3,
  },
});
