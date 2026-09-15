import { BottomNavigation } from "../../components/navigation/BottomNavigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pg-stage">
      <div className="pg-phone">
        <div className="pg-screen">
          {children}
        </div>
        <BottomNavigation />
      </div>
    </div>
  );
}
