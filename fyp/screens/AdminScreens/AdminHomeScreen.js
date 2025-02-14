import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

export default function AdminHomeScreen() {
  return (
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
        yAxisLabel=""
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
          { name: 'Active', population: 400, color: '#36A2EB', legendFontColor: '#333', legendFontSize: 14 },
          { name: 'Inactive', population: 100, color: '#FF6384', legendFontColor: '#333', legendFontSize: 14 },
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
  );
}

const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: { borderRadius: 10 },
  propsForDots: { r: '6', strokeWidth: '2', stroke: '#36A2EB' },
};

const styles = StyleSheet.create({
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

