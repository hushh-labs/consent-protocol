"use client";

import { toast } from "sonner";
import { type ColorVariant } from "./types";
import { getVariantStylesNoHover, getIconColor } from "./utils";
import {
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useIconWeight } from "./icon-theme-context";

// ============================================================================
// GLOBAL TOAST PERSISTENCE SYSTEM
// ============================================================================

// Toast options interface
interface ToastOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAutoClose?: () => void;
  className?: string;
  description?: string;
}

interface PersistentToast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
  options?: ToastOptions;
  timestamp: number;
}

const PERSISTENT_TOASTS_KEY = "morphy-persistent-toasts";

class GlobalToastManager {
  private static instance: GlobalToastManager;
  private pendingToasts: PersistentToast[] = [];
  private isInitialized = false;

  static getInstance(): GlobalToastManager {
    if (!GlobalToastManager.instance) {
      GlobalToastManager.instance = new GlobalToastManager();
    }
    return GlobalToastManager.instance;
  }

  initialize() {
    if (this.isInitialized) return;

    // Load any pending toasts from sessionStorage
    this.loadPendingToasts();

    // Show pending toasts
    this.showPendingToasts();

    this.isInitialized = true;
  }

  private loadPendingToasts() {
    if (typeof window === "undefined") return;

    try {
      const stored = sessionStorage.getItem(PERSISTENT_TOASTS_KEY);
      if (stored) {
        const parsedToasts: PersistentToast[] = JSON.parse(stored);
        // Only keep toasts from the last 30 seconds to avoid showing stale toasts
        const now = Date.now();
        this.pendingToasts = parsedToasts.filter(
          (toast) => now - toast.timestamp < 30000
        );
        // Clear the stored toasts
        sessionStorage.removeItem(PERSISTENT_TOASTS_KEY);
      }
    } catch (error) {
      console.warn("Failed to load pending toasts:", error);
      sessionStorage.removeItem(PERSISTENT_TOASTS_KEY);
    }
  }

  private showPendingToasts() {
    this.pendingToasts.forEach((toastData) => {
      setTimeout(() => {
        this.showToast(toastData.type, toastData.message, toastData.options);
      }, 100); // Small delay to ensure DOM is ready
    });
    this.pendingToasts = [];
  }

  private showToast(
    type: "success" | "error" | "warning" | "info",
    message: string,
    options?: ToastOptions
  ) {
    switch (type) {
      case "success":
        toast.success(message, options);
        break;
      case "error":
        toast.error(message, options);
        break;
      case "warning":
        toast.warning(message, options);
        break;
      case "info":
        toast.info(message, options);
        break;
    }
  }

  // Public methods for persistent toasts
  persistToast(
    type: "success" | "error" | "warning" | "info",
    message: string,
    options?: ToastOptions
  ) {
    if (typeof window === "undefined") return;

    const persistentToast: PersistentToast = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      duration: options?.duration,
      options,
      timestamp: Date.now(),
    };

    // If we're initialized, show immediately
    if (this.isInitialized) {
      this.showToast(type, message, options);
    } else {
      // Otherwise, store for later
      this.pendingToasts.push(persistentToast);
      try {
        sessionStorage.setItem(
          PERSISTENT_TOASTS_KEY,
          JSON.stringify(this.pendingToasts)
        );
      } catch (error) {
        console.warn("Failed to persist toast:", error);
      }
    }
  }
}

// Export singleton instance
export const globalToastManager = GlobalToastManager.getInstance();

// ============================================================================
// ENHANCED TOAST UTILITIES WITH MORPHY-UI INTEGRATION
// ============================================================================

interface ToastOptions {
  variant?: ColorVariant;
  duration?: number;
  description?: string;
}

// ============================================================================
// TOAST FUNCTIONS WITH MORPHY-UI VARIANTS
// ============================================================================

// Initialize the global toast manager when this module is imported
if (typeof window !== "undefined") {
  globalToastManager.initialize();
}

export const useMorphyToast = () => {
  const iconWeight = useIconWeight();

  const success = (message: string, options: ToastOptions = {}) => {
    const {
      variant = "green-gradient",
      duration = 3000,
      description,
    } = options;

    return toast.success(message, {
      duration,
      description,
      icon: (
        <CheckCircleIcon
          className="h-4 w-4"
          weight={iconWeight}
          style={{ color: getIconColor(variant, "fill") }}
        />
      ),
      className: getVariantStylesNoHover(variant, "fill"),
    });
  };

  const error = (message: string, options: ToastOptions = {}) => {
    const {
      variant = "orange-gradient",
      duration = 5000,
      description,
    } = options;

    return toast.error(message, {
      duration,
      description,
      icon: (
        <XCircleIcon
          className="h-4 w-4"
          weight={iconWeight}
          style={{ color: getIconColor(variant, "fill") }}
        />
      ),
      className: getVariantStylesNoHover(variant, "fill"),
    });
  };

  const warning = (message: string, options: ToastOptions = {}) => {
    const {
      variant = "orange-gradient",
      duration = 4000,
      description,
    } = options;

    return toast.warning(message, {
      duration,
      description,
      icon: (
        <WarningIcon
          className="h-4 w-4"
          weight={iconWeight}
          style={{ color: getIconColor(variant, "fill") }}
        />
      ),
      className: getVariantStylesNoHover(variant, "fill"),
    });
  };

  const info = (message: string, options: ToastOptions = {}) => {
    const { variant = "blue-gradient", duration = 4000, description } = options;

    return toast.info(message, {
      duration,
      description,
      icon: (
        <InfoIcon
          className="h-4 w-4"
          weight={iconWeight}
          style={{ color: getIconColor(variant, "fill") }}
        />
      ),
      className: getVariantStylesNoHover(variant, "fill"),
    });
  };

  const custom = (
    message: string,
    options: ToastOptions & { icon?: React.ReactNode } = {}
  ) => {
    const {
      variant = "gradient",
      duration = 4000,
      description,
      icon,
    } = options;

    return toast(message, {
      duration,
      description,
      icon: icon || (
        <SparkleIcon
          className="h-4 w-4"
          weight={iconWeight}
          style={{ color: getIconColor(variant, "fill") }}
        />
      ),
      className: getVariantStylesNoHover(variant, "fill"),
    });
  };

  // Persistent versions that survive page navigation
  const persistentSuccess = (message: string, options: ToastOptions = {}) => {
    globalToastManager.persistToast("success", message, options);
  };

  const persistentError = (message: string, options: ToastOptions = {}) => {
    globalToastManager.persistToast("error", message, options);
  };

  const persistentWarning = (message: string, options: ToastOptions = {}) => {
    globalToastManager.persistToast("warning", message, options);
  };

  const persistentInfo = (message: string, options: ToastOptions = {}) => {
    globalToastManager.persistToast("info", message, options);
  };

  return {
    success,
    error,
    warning,
    info,
    custom,
    dismiss: toast.dismiss,
    promise: toast.promise,
    // Persistent versions
    persistentSuccess,
    persistentError,
    persistentWarning,
    persistentInfo,
  };
};

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const morphyToast = {
  success: (message: string, options?: ToastOptions) => {
    const {
      variant = "green-gradient",
      duration = 3000,
      description,
    } = options || {};

    return toast.success(message, {
      duration,
      description,
      className: getVariantStylesNoHover(variant, "fill"),
    });
  },

  error: (message: string, options?: ToastOptions) => {
    const {
      variant = "orange-gradient",
      duration = 5000,
      description,
    } = options || {};

    return toast.error(message, {
      duration,
      description,
      className: getVariantStylesNoHover(variant, "fill"),
    });
  },

  warning: (message: string, options?: ToastOptions) => {
    const {
      variant = "orange-gradient",
      duration = 4000,
      description,
    } = options || {};

    return toast.warning(message, {
      duration,
      description,
      className: getVariantStylesNoHover(variant, "fill"),
    });
  },

  info: (message: string, options?: ToastOptions) => {
    const {
      variant = "blue-gradient",
      duration = 4000,
      description,
    } = options || {};

    return toast.info(message, {
      duration,
      description,
      className: getVariantStylesNoHover(variant, "fill"),
    });
  },

  custom: (
    message: string,
    options?: ToastOptions & { icon?: React.ReactNode }
  ) => {
    const {
      variant = "gradient",
      duration = 4000,
      description,
      icon,
    } = options || {};

    return toast(message, {
      duration,
      description,
      icon,
      className: getVariantStylesNoHover(variant, "fill"),
    });
  },
};
