package app.paygauge.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Home-screen widget: progress ring, total left to pay and the next payment due. */
public class TallyWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "tally_widget";
    static final String KEY_SNAPSHOT = "snapshot";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) render(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        render(context, manager, appWidgetId);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TallyWidgetProvider.class));
        for (int id : ids) render(context, manager, id);
    }

    static void render(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.tally_widget);
        String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SNAPSHOT, null);

        double left = 0;
        double percent = 0;
        boolean hasDebts = false;
        String nextName = null;
        String nextDate = null;
        double nextAmount = -1;
        if (json != null) {
            try {
                JSONObject snapshot = new JSONObject(json);
                left = snapshot.optDouble("left", 0);
                percent = snapshot.optDouble("percentPaid", 0);
                hasDebts = snapshot.optBoolean("hasDebts", false);
                nextName = snapshot.isNull("nextName") ? null : snapshot.optString("nextName", null);
                nextDate = snapshot.isNull("nextDate") ? null : snapshot.optString("nextDate", null);
                nextAmount = snapshot.isNull("nextAmount") ? -1 : snapshot.optDouble("nextAmount", -1);
            } catch (JSONException ignored) {
                json = null;
            }
        }

        NumberFormat whole = NumberFormat.getCurrencyInstance(Locale.US);
        whole.setMaximumFractionDigits(0);
        NumberFormat cents = NumberFormat.getCurrencyInstance(Locale.US);

        if (json == null) {
            views.setTextViewText(R.id.widget_label, "Tally");
            views.setTextViewText(R.id.widget_value, "See what's left");
            views.setTextViewText(R.id.widget_next, "Open Tally to get started");
        } else {
            views.setTextViewText(R.id.widget_label, hasDebts ? "Left to pay" : "Next payment");
            if (hasDebts) {
                views.setTextViewText(R.id.widget_value, whole.format(left));
            } else {
                views.setTextViewText(R.id.widget_value, nextAmount >= 0 ? cents.format(nextAmount) : "All clear");
            }
            String next;
            if (nextName == null) {
                next = "Nothing due";
            } else if (hasDebts) {
                next = "Next: " + nextName + " · " + shortDate(nextDate) + (nextAmount >= 0 ? " · " + cents.format(nextAmount) : "");
            } else {
                next = nextName + " · " + shortDate(nextDate);
            }
            views.setTextViewText(R.id.widget_next, next);
        }

        int ringSize = dp(context, 64);
        if (hasDebts) {
            views.setViewVisibility(R.id.widget_ring_box, View.VISIBLE);
            views.setImageViewBitmap(R.id.widget_ring, ring(context, (float) percent, ringSize));
            views.setTextViewText(R.id.widget_percent, Math.round(percent) + "%");
        } else {
            views.setViewVisibility(R.id.widget_ring_box, View.GONE);
        }

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, flags));

        manager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap ring(Context context, float percent, int size) {
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        float stroke = size * 0.13f;
        RectF bounds = new RectF(stroke / 2f, stroke / 2f, size - stroke / 2f, size - stroke / 2f);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(context.getResources().getColor(R.color.tally_widget_track, context.getTheme()));
        canvas.drawArc(bounds, 0, 360, false, paint);
        float clamped = Math.max(0f, Math.min(percent, 100f));
        if (clamped > 0f) {
            paint.setShader(new LinearGradient(0, 0, size, size, 0xFF3B82F6, 0xFF8B5CF6, Shader.TileMode.CLAMP));
            canvas.drawArc(bounds, -90, Math.max(clamped, 1.5f) * 3.6f, false, paint);
        }
        return bitmap;
    }

    private static String shortDate(String isoDate) {
        if (isoDate == null) return "";
        try {
            Date date = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(isoDate);
            return date == null ? isoDate : new SimpleDateFormat("MMM d", Locale.getDefault()).format(date);
        } catch (ParseException e) {
            return isoDate;
        }
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
