package com.haiphongdao.tuantrawb;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class WebAppInterface {
    private final Context context;

    public WebAppInterface(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    @JavascriptInterface
    public void scheduleAlarm(String title, String message, long triggerAtMillis, String nextPoint) {
        if (triggerAtMillis <= System.currentTimeMillis()) {
            return;
        }

        // Lưu thông tin vào SharedPreferences để phục hồi sau khi reboot máy
        SharedPreferences prefs = context.getSharedPreferences("tuantrawb_prefs", Context.MODE_PRIVATE);
        prefs.edit()
                .putLong("pending_alarm_due", triggerAtMillis)
                .putString("pending_alarm_title", title)
                .putString("pending_alarm_message", message)
                .putString("pending_alarm_next", nextPoint)
                .apply();

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent alarmIntent = new Intent(context, AlarmReceiver.class);
        alarmIntent.setAction(AlarmReceiver.ACTION_ALARM);
        alarmIntent.putExtra("title", title);
        alarmIntent.putExtra("message", message);
        alarmIntent.putExtra("nextPoint", nextPoint);

        PendingIntent pi = PendingIntent.getBroadcast(
                context,
                1001,
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }

            SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss", Locale.getDefault());
            String timeStr = sdf.format(new Date(triggerAtMillis));
            showToast("Đã hẹn báo thức lúc " + timeStr + (nextPoint != null && !nextPoint.isEmpty() ? " (" + nextPoint + ")" : ""));
        } catch (SecurityException se) {
            // Android 12+ nếu chưa cấp quyền SCHEDULE_EXACT_ALARM
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void cancelAlarm() {
        SharedPreferences prefs = context.getSharedPreferences("tuantrawb_prefs", Context.MODE_PRIVATE);
        prefs.edit().remove("pending_alarm_due").apply();

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            Intent alarmIntent = new Intent(context, AlarmReceiver.class);
            alarmIntent.setAction(AlarmReceiver.ACTION_ALARM);
            PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    1001,
                    alarmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            am.cancel(pi);
        }

        // Tắt chuông nếu đang kêu
        Intent stopIntent = new Intent(context, AlarmSoundService.class);
        stopIntent.setAction(AlarmSoundService.ACTION_STOP);
        context.startService(stopIntent);
    }

    @JavascriptInterface
    public void testAlarm() {
        Intent alarmIntent = new Intent(context, AlarmReceiver.class);
        alarmIntent.setAction(AlarmReceiver.ACTION_ALARM);
        alarmIntent.putExtra("title", "Thử chuông tuần tra");
        alarmIntent.putExtra("message", "Chuông đang kêu thử nghiệm");
        alarmIntent.putExtra("nextPoint", "Điểm thử nghiệm");
        context.sendBroadcast(alarmIntent);
    }

    @JavascriptInterface
    public void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(context.getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(intent);
                } catch (Exception e) {
                    Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    fallback.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(fallback);
                }
            } else {
                showToast("Ứng dụng đã được cấp quyền chạy nền tối ưu!");
            }
        }
    }

    private void showToast(final String msg) {
        if (context instanceof MainActivity) {
            ((MainActivity) context).runOnUiThread(() -> Toast.makeText(context, msg, Toast.LENGTH_SHORT).show());
        }
    }
}
