import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Title, Snackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { login, clearError } from '@/store/slices/authSlice';
import { authenticateWithBiometric, checkBiometricSupport } from '@/utils/biometric';

export default function LoginScreen({ navigation }: any) {
    const dispatch = useDispatch<AppDispatch>();
    const { loading, error } = useSelector((state: RootState) => state.auth);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [biometricAvailable, setBiometricAvailable] = useState(false);

    useEffect(() => {
        checkBiometric();
    }, []);

    const checkBiometric = async () => {
        const available = await checkBiometricSupport();
        setBiometricAvailable(available);
    };

    const handleLogin = () => {
        dispatch(login({ email, password }));
    };

    const handleBiometricLogin = async () => {
        const success = await authenticateWithBiometric();
        if (success) {
            // Auto-login with saved credentials
            handleLogin();
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Title style={styles.title}>SecureBank</Title>
                <Text style={styles.subtitle}>Sign in to your account</Text>

                <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                />

                <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                />

                <Button
                    mode="contained"
                    onPress={handleLogin}
                    loading={loading}
                    disabled={loading}
                    style={styles.button}
                >
                    Sign In
                </Button>

                {biometricAvailable && (
                    <Button
                        mode="outlined"
                        onPress={handleBiometricLogin}
                        style={styles.button}
                        icon="fingerprint"
                    >
                        Use Biometric
                    </Button>
                )}

                <Button
                    mode="text"
                    onPress={() => navigation.navigate('Register')}
                    style={styles.linkButton}
                >
                    Don't have an account? Sign up
                </Button>
            </View>

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
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        textAlign: 'center',
        marginBottom: 8,
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
