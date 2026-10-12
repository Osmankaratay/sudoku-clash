import React from 'react';
import { getAvatarById } from '../utils/avatars.ts';

interface AvatarBadgeProps {
  avatarId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBorder?: boolean;
  className?: string;
}

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  avatarId,
  size = 'md',
  showBorder = true,
  className = '',
}) => {
  const avatar = getAvatarById(avatarId);

  const sizeClasses = {
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-lg',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl font-mono font-bold select-none shrink-0 ${sizeClasses} ${avatar.colorBg} ${avatar.textColor} ${
        showBorder ? `border ${avatar.colorBorder}` : ''
      } ${className}`}
      title={`${avatar.name} (${avatar.title})`}
    >
      <span>{avatar.initials}</span>
      {/* Decorative micro dot */}
      <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-current opacity-70" />
    </div>
  );
};
