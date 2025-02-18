import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const ProductDetailComponent = () => {
  // Dummy data
  const product = {
    id: "1",
    name: "Smartphone",
    price: "$699",
    image: "https://via.placeholder.com/200",
    description: "This is a great product with amazing features."
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: product.image }} style={styles.productImage} />
      <Text style={styles.productName}>{product.name}</Text>
      <Text style={styles.productPrice}>{product.price}</Text>
      <Text style={styles.productDescription}>{product.description}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  productImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  productName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  productPrice: {
    fontSize: 18,
    color: '#007BFF',
    fontWeight: 'bold',
    marginVertical: 5,
  },
  productDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    color: 'gray',
  },
});

export default ProductDetailComponent;
