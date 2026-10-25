package com.haiphongdao.tuantrawb;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            SharedPreferences prefs = context.getSharedPreferences("tuantrawb_prefs", Context.MODE_PRIVATE);
            long due = prefs.getLong("pending_alarm_due", 0);
            if (due > System.currentTimeMillis()) {
                String title = prefs.getString("pending_alarm_title", "Đến giờ tuần tra");
                String message = prefs.getString("pending_alarm_message", "Đến giờ di chuyển");
                String nextPoint = prefs.getString("pending_alarm_next", "");

                AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (am != null) {
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

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, due, pi);
                    } else {
                        am.setExact(AlarmManager.RTC_WAKEUP, due, pi);
                    }
                }
            }
        }
    }
}
