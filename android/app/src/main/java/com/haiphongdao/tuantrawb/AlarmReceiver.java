package com.haiphongdao.tuantrawb;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

public class AlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_ALARM = "com.haiphongdao.tuantrawb.ACTION_ALARM";
    public static final String ACTION_STOP_ALARM = "com.haiphongdao.tuantrawb.ACTION_STOP_ALARM";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (ACTION_STOP_ALARM.equals(action)) {
            Intent stopIntent = new Intent(context, AlarmSoundService.class);
            stopIntent.setAction(AlarmSoundService.ACTION_STOP);
            context.startService(stopIntent);
            return;
        }

        // WakeLock tạm thời để thiết bị không ngủ trước khi Service khởi động
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TuanTraWB:AlarmWakeLock");
            wakeLock.acquire(15000); // 15 giây
        }

        try {
            Intent serviceIntent = new Intent(context, AlarmSoundService.class);
            serviceIntent.setAction(AlarmSoundService.ACTION_START);
            serviceIntent.putExtra("title", intent.getStringExtra("title"));
            serviceIntent.putExtra("message", intent.getStringExtra("message"));
            serviceIntent.putExtra("nextPoint", intent.getStringExtra("nextPoint"));

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {}
            }
        }
    }
}
