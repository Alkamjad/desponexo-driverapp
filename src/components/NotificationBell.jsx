import React from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useNotifications } from "@/components/NotificationHub";

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const onClick = () => {
    navigate(createPageUrl('Notifications'));
  };

  return (
    <button type="button" aria-label="Benachrichtigungen" onClick={onClick} className="relative">
      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors">
        <Bell className="w-5 h-5 text-white" />
      </div>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}