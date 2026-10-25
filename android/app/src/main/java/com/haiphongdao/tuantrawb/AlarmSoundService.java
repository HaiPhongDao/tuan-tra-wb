package com.haiphongdao.tuantrawb;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class AlarmSoundService extends Service {
    public static final String ACTION_START = "com.haiphongdao.tuantrawb.START_ALARM_SOUND";
    public static final String ACTION_STOP = "com.haiphongdao.tuantrawb.STOP_ALARM_SOUND";
    public static final String CHANNEL_ID = "patrol_alarm_channel_v2";
    public static final int NOTIFICATION_ID = 9999;

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private Handler handler;
    private Runnable stopRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        handler = new Handler(Looper.getMainLooper());
        stopRunnable = this::stopSelf;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopAlarm();
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra("title");
        String message = intent.getStringExtra("message");
        String nextPoint = intent.getStringExtra("nextPoint");

        if (title == null) title = "Đến giờ tuần tra!";
        if (message == null) message = "Đã đến giờ tuần tra điểm kế tiếp.";

        createNotificationChannel();
        Notification notification = buildNotification(title, message, nextPoint);
        startForeground(NOTIFICATION_ID, notification);

        startSoundAndVibration();

        // Tự động tắt chuông sau 2 phút để không hao pin nếu người dùng bỏ quên máy
        handler.removeCallbacks(stopRunnable);
        handler.postDelayed(stopRunnable, 120000);

        return START_NOT_STICKY;
    }

    private void startSoundAndVibration() {
        try {
            if (mediaPlayer == null) {
                Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alertUri == null) {
                    alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }

                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(this, alertUri);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                mediaPlayer.setAudioAttributes(audioAttributes);
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                mediaPlayer.setLooping(true);
                mediaPlayer.prepare();
                mediaPlayer.start();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 600, 300, 600, 300, 600, 300, 600};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void stopAlarm() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception ignored) {}

        try {
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception ignored) {}

        if (handler != null && stopRunnable != null) {
            handler.removeCallbacks(stopRunnable);
        }
    }

    private Notification buildNotification(String title, String message, String nextPoint) {
        // Intent mở ứng dụng trực tiếp
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openAppIntent.putExtra("from_alarm", true);
        openAppIntent.putExtra("nextPoint", nextPoint);
        PendingIntent pOpenApp = PendingIntent.getActivity(this, 1, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Intent tắt chuông
        Intent stopSoundIntent = new Intent(this, AlarmSoundService.class);
        stopSoundIntent.setAction(ACTION_STOP);
        PendingIntent pStopSound = PendingIntent.getService(this, 2, stopSoundIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Full Screen Intent cho màn hình khoá
        Intent fullScreenIntent = new Intent(this, AlarmAlertActivity.class);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("message", message);
        fullScreenIntent.putExtra("nextPoint", nextPoint);
        PendingIntent pFullScreen = PendingIntent.getActivity(this, 3, fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle("⏰ " + title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(pOpenApp)
                .setFullScreenIntent(pFullScreen, true)
                .addAction(android.R.drawable.ic_media_play, "MỞ ỨNG DỤNG", pOpenApp)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "TẮT CHUÔNG", pStopSound)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Nhắc nhở tuần tra (Báo thức)",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Chuông báo thức khi đến giờ tuần tra");
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 600, 300, 600, 300, 600});
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        stopAlarm();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
