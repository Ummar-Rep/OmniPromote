"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  name,
  value,
  confirm,
  formNoValidate,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonClass;
  className?: string;
  name?: string;
  value?: string;
  confirm?: string;
  formNoValidate?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formNoValidate={formNoValidate}
      disabled={pending}
      className={`${buttonClass[variant]} ${className}`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
