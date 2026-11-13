import { BottomNavigation } from "../../components/navigation/BottomNavigation";
import { NotificationScheduler } from "../../components/navigation/NotificationScheduler";
import { ThemeSync } from "../../components/navigation/ThemeSync";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pg-stage">
      <div className="pg-phone">
        <div className="pg-screen">
          <NotificationScheduler />
          <ThemeSync />
          {children}
        </div>
        <BottomNavigation />
      </div>
    </div>
  );
}
