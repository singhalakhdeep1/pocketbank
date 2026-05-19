import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Title, Snackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { register, clearError } from '@/store/slices/authSlice';

export default function RegisterScreen({ navigation }: any) {
    const dispatch = useDispatch<AppDispatch>();
    const { loading, error } = useSelector((state: RootState) => state.auth);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
    });

    const handleChange = (field: string, value: string) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleRegister = () => {
        dispatch(register(formData));
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.content}>
                <Title style={styles.title}>Create Account</Title>
                <Text style={styles.subtitle}>Join SecureBank today</Text>

                <TextInput
                    label="First Name"
                    value={formData.firstName}
                    onChangeText={(value) => handleChange('firstName', value)}
                    mode="outlined"
                    style={styles.input}
                />

                <TextInput
                    label="Last Name"
                    value={formData.lastName}
                    onChangeText={(value) => handleChange('lastName', value)}
                    mode="outlined"
                    style={styles.input}
                />

                <TextInput
                    label="Email"
                    value={formData.email}
                    onChangeText={(value) => handleChange('email', value)}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                />

                <TextInput
                    label="Phone"
                    value={formData.phone}
                    onChangeText={(value) => handleChange('phone', value)}
                    mode="outlined"
                    keyboardType="phone-pad"
                    style={styles.input}
                />

                <TextInput
                    label="Password"
                    value={formData.password}
                    onChangeText={(value) => handleChange('password', value)}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                />

                <Button
                    mode="contained"
                    onPress={handleRegister}
                    loading={loading}
                    disabled={loading}
                    style={styles.button}
                >
                    Create Account
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.navigate('Login')}
                    style={styles.linkButton}
                >
                    Already have an account? Sign in
                </Button>
            </ScrollView>

            <Snackbar
                visible={!!error}
                onDismiss={() => dispatch(clearError())}
                duration={3000}
            >
                {error}
            </Snackbar>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 32,
        textAlign: 'center',
        marginBottom: 8,
        marginTop: 40,
        color: '#1976d2',
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        color: '#666',
    },
    input: {
        marginBottom: 16,
    },
    button: {
        marginTop: 8,
    },
    linkButton: {
        marginTop: 16,
    },
});
