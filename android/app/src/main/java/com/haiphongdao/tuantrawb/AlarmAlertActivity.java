package com.haiphongdao.tuantrawb;

import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class AlarmAlertActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Bật sáng màn hình và hiển thị trên màn hình khoá
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        setContentView(R.layout.activity_alarm_alert);

        TextView tvNextPoint = findViewById(R.id.tvNextPoint);
        TextView tvStaffName = findViewById(R.id.tvStaffName);
        Button btnOpenApp = findViewById(R.id.btnOpenApp);
        Button btnDismiss = findViewById(R.id.btnDismiss);

        String title = getIntent().getStringExtra("title");
        String message = getIntent().getStringExtra("message");
        String nextPoint = getIntent().getStringExtra("nextPoint");

        if (nextPoint != null && !nextPoint.isEmpty()) {
            tvNextPoint.setText("Điểm kế tiếp: " + nextPoint);
        } else if (title != null) {
            tvNextPoint.setText(title);
        }

        if (message != null) {
            tvStaffName.setText(message);
        }

        btnOpenApp.setOnClickListener(v -> {
            stopAlarmSound();
            Intent intent = new Intent(AlarmAlertActivity.this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("from_alarm", true);
            intent.putExtra("nextPoint", nextPoint);
            startActivity(intent);
            finish();
        });

        btnDismiss.setOnClickListener(v -> {
            stopAlarmSound();
            finish();
        });
    }

    private void stopAlarmSound() {
        Intent stopIntent = new Intent(this, AlarmSoundService.class);
        stopIntent.setAction(AlarmSoundService.ACTION_STOP);
        startService(stopIntent);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(AlarmSoundService.NOTIFICATION_ID);
        }
    }

    @Override
    public void onBackPressed() {
        stopAlarmSound();
        super.onBackPressed();
    }
}
