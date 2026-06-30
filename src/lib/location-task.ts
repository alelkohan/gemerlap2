import { Platform } from "react-native";
import { apiFetch } from "./api";

export const LOCATION_TASK_NAME = "tps-background-location-task";

// Cache variables to prevent spamming
let lastWarningTime = 0;
const WARNING_COOLDOWN_MS = 60000; // 1 minute cooldown between outside alerts

// Guard: only import native modules on native platforms
const isNative = Platform.OS !== "web";

// 1. Start Background Location Tracking
export async function startBackgroundTracking() {
  if (!isNative) return true; // No-op on web

  const Location = await import("expo-location");
  const Notifications = await import("expo-notifications");
  const TaskManager = await import("expo-task-manager");

  // Foreground location permission
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") {
    throw new Error("Izin lokasi diperlukan untuk melakukan absensi check-in");
  }

  // Request notification permissions
  try {
    await Notifications.requestPermissionsAsync();
  } catch (err) {
    console.warn("Gagal meminta izin notifikasi");
  }

  // Background location permission (necessary for geofencing when app is closed)
  let hasBgPermission = false;
  try {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    hasBgPermission = bgStatus === "granted";
  } catch (err: any) {
    console.warn("Gagal meminta izin lokasi latar belakang:", err.message);
  }

  // Start background location updates
  if (hasBgPermission) {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 300000,
          distanceInterval: 50,
          deferredUpdatesInterval: 300000,
          deferredUpdatesDistance: 50,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "Absensi TPS Aktif",
            notificationBody: "Melacak kehadiran Anda di area TPS",
            notificationColor: "#10B981",
          },
        });
      }
    } catch (err: any) {
      console.warn("Gagal memulai updates lokasi latar belakang:", err.message);
    }
  } else {
    console.warn("Background tracking dinonaktifkan karena tidak mendapat izin lokasi latar belakang.");
  }

  return true;
}

// 2. Stop Background Location Tracking
export async function stopBackgroundTracking() {
  if (!isNative) return; // No-op on web

  const TaskManager = await import("expo-task-manager");
  const Location = await import("expo-location");

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (err: any) {
    console.warn("Gagal menghentikan background tracking:", err.message);
  }
}

// 3. Define Background Task Manager (native only)
if (isNative) {
  Promise.all([
    import("expo-task-manager"),
    import("expo-location"),
    import("expo-notifications"),
  ]).then(([TaskManager, _Location, Notifications]) => {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
      if (error) {
        console.error("Background location task error:", error);
        return;
      }
      if (data) {
        const { locations } = data;
        if (locations && locations.length > 0) {
          const location = locations[locations.length - 1];
          const { latitude, longitude } = location.coords;

          try {
            const res = await apiFetch("/absensi/heartbeat", {
              method: "POST",
              body: { latitude, longitude },
            });

            if (res.status === "outside") {
              const now = Date.now();
              if (now - lastWarningTime > WARNING_COOLDOWN_MS) {
                lastWarningTime = now;
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: "⚠️ Di Luar Area TPS",
                    body: "Anda terdeteksi di luar area TPS. Sesi Anda akan dihentikan otomatis dalam 1 menit jika tidak kembali.",
                    sound: true,
                  },
                  trigger: null,
                });
              }
            } else if (res.status === "auto_checked_out") {
              await stopBackgroundTracking();
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "✅ Sesi Berakhir",
                  body: "Anda berada di luar TPS terlalu lama. Sesi telah di-checkout secara otomatis.",
                  sound: true,
                },
                trigger: null,
              });
            }
          } catch (err: any) {
            console.warn("Location heartbeat failed:", err.message);
          }
        }
      }
    });
  }).catch(() => {});
}
