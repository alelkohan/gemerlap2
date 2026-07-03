import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth-context";
import { Colors as DefaultColors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { View, ActivityIndicator, Platform } from "react-native";
import { useEffect } from "react";
import { registerForPushNotificationsAsync } from "@/src/lib/push-token";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const Colors = useColors();

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync();
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          height: Platform.OS === "ios" ? 86 : 92,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 32,
          backgroundColor: Colors.surface || "#fff",
          borderTopWidth: 1,
          borderTopColor: Colors.borderLight,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="timbangan"
        options={{
          title: "Timbangan",
          tabBarIcon: ({ color, size }) => <Ionicons name="scale" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="absen"
        options={{
          title: "Absen",
          href: user?.role === "auditor" ? null : "/(tabs)/absen",
          tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="keuangan"
        options={{
          title: "Keuangan",
          href: user?.role === "auditor" ? "/(tabs)/keuangan" : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="master"
        options={{
          title: "Master",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />

    </Tabs>
  );
}
