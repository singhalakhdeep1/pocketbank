import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { List, Divider, Button } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { logout } from '@/store/slices/authSlice';

export default function ProfileScreen() {
    const dispatch = useDispatch<AppDispatch>();
    const { user } = useSelector((state: RootState) => state.auth);

    const handleLogout = () => {
        dispatch(logout());
    };

    return (
        <ScrollView style={styles.container}>
            <List.Section>
                <List.Subheader>Account Information</List.Subheader>
                <List.Item
                    title="Name"
                    description={`${user?.firstName} ${user?.lastName}`}
                    left={(props) => <List.Icon {...props} icon="account" />}
                />
                <Divider />
                <List.Item
                    title="Email"
                    description={user?.email}
                    left={(props) => <List.Icon {...props} icon="email" />}
                />
                <Divider />
                <List.Item
                    title="Phone"
                    description={user?.phone || 'Not provided'}
                    left={(props) => <List.Icon {...props} icon="phone" />}
                />
            </List.Section>

            <List.Section>
                <List.Subheader>Security</List.Subheader>
                <List.Item
                    title="Change Password"
                    left={(props) => <List.Icon {...props} icon="lock" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Enable Biometric"
                    left={(props) => <List.Icon {...props} icon="fingerprint" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Two-Factor Authentication"
                    left={(props) => <List.Icon {...props} icon="shield-check" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                />
            </List.Section>

            <List.Section>
                <List.Subheader>Preferences</List.Subheader>
                <List.Item
                    title="Notifications"
                    left={(props) => <List.Icon {...props} icon="bell" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Language"
                    description="English"
                    left={(props) => <List.Icon {...props} icon="translate" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                />
            </List.Section>

            <Button
                mode="contained"
                onPress={handleLogout}
                style={styles.logoutButton}
                icon="logout"
            >
                Logout
            </Button>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    logoutButton: {
        margin: 20,
        backgroundColor: '#dc004e',
    },
});
