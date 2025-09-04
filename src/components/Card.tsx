// components/Card.tsx
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = "" }) => {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg p-6 border border-gray-100 ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
