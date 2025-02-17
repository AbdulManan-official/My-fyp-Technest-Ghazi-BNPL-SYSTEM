// screens/ProductDetailScreen.js
import React from 'react';
import { View, Button } from 'react-native';
import ProductDetailComponent from '../../Components/ProductDetailComponent ';
const ProductDetailScreen = ({ route, navigation }) => {
  const { product } = route.params;

  return (
    <View>
      <ProductDetailComponent product={product} />
      <Button title="Go Back" onPress={() => navigation.goBack()} />
    </View>
  );
};

export default ProductDetailScreen;
