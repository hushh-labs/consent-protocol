"use client";

import React, { useMemo, useCallback, useRef } from "react";
import {
  HouseIcon,
  ShieldCheckIcon,
  QrCodeIcon,
  SparkleIcon,
  DotsThreeIcon,
  GraduationCap,
  BookOpen,
  ChartBar,
  UsersThreeIcon,
  CaretUpIcon,
  CaretRightIcon,
  PhoneIcon,
  InfoIcon,
  BuildingsIcon,
  BriefcaseIcon,
  BrowserIcon,
  AtomIcon,
  CalendarDots,
  FileTextIcon,
  CurrencyCircleDollarIcon,
  HeartIcon,
  PawPrintIcon,
  PlantIcon,
  FishSimpleIcon,
} from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { GradientText } from "@/components/ui/gradient-text";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getColorClass,
  getGradientClasses,
  getBadgeClasses,
} from "@/lib/morphy-ux/morphy";

const NavButton = ({
  item,
  isActive,
  isDesktop = false,
}: {
  item: {
    href: string;
    icon: React.ElementType | null;
    label: string;
  };
  isActive: boolean;
  isDesktop?: boolean;
}) => {
  // const iconWeight = useIconWeight();
  const iconWeight = "regular";

  return (
    <Link href={item.href} aria-label={item.label}>
      <Button
        variant={isActive ? "multi" : "link"}
        effect="fill"
        size={isDesktop ? "default" : "default"}
        className={cn(
          "h-auto transition-all duration-200 flex items-center gap-2", // always row
          isDesktop ? "font-semibold" : "rounded-full px-4 py-3"
        )}
        title={item.label}
        showRipple={false}
      >
        {item.icon &&
          React.createElement(item.icon, {
            className: "h-5 w-5",
            weight: isActive ? "duotone" : iconWeight,
          })}
        <span className="text-base font-medium">{item.label}</span>
      </Button>
    </Link>
  );
};

export const Navbar = () => {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const iconWeight = "regular";

  // ===== OPTIMIZED PATHNAME CHECKS =====
  // Memoize pathname comparison function to avoid repeated calculations
  const isPathActive = useCallback(
    (path: string) => pathname === path,
    [pathname]
  );

  // ===== CENTRALIZED NAVIGATION CONFIGURATION =====
  // This defines which links appear where on desktop and mobile navigation pills
  //
  // HOW TO MODIFY NAVIGATION:
  // 1. To add a new link to desktop primary pills: add the label to desktopPrimary array
  // 2. To add a new link to desktop "More" dropdown: add the label to desktopMore array
  // 3. To add a new link to mobile primary pills: add the label to mobilePrimary array
  // 4. To add a new link to mobile "More" dropdown: add the label to mobileMore array
  // 5. To make a route highlight the "More" button: add the path to moreRoutes array
  // 6. To add breadcrumb navigation: add the section and its pages to breadcrumbSections
  // 7. To add a new navigation item: add it to allItems array with icon and label
  //
  // NAVIGATION STRUCTURE:
  // Desktop Pills: Home, Products, About (primary) + More (dropdown)
  // Mobile Pills: Home, Products, About (primary) + More (dropdown)
  // Desktop CTA: Schedule Demo (separate button)
  // Mobile CTA: Schedule Demo (inside More dropdown)

  // ===== NAVIGATION ARRAYS WITH POSITION NUMBERING =====
  //
  // HOW TO MODIFY NAVIGATION USING POSITION ARRAYS:
  //
  // 1. ADD NEW NAVIGATION ITEM:
  //    - Add the item to the appropriate position in desktopNavigation or mobileNavigation
  //    - Each position represents a specific area in the UI
  //    - Items within each position are rendered in order
  //
  // 2. CHANGE POSITION OF EXISTING ITEM:
  //    - Move the item object to a different position array
  //    - Update the position number if needed
  //
  // 3. ADD NEW POSITION:
  //    - Add a new object with unique position number
  //    - Choose appropriate type: "primary", "more", "cta", "theme"
  //
  // 4. NAVIGATION STRUCTURE:
  //    Desktop: Position 0 (Primary) → Position 1 (More) → Position 2 (CTA) → Position 3 (Theme)
  //    Mobile:  Position 0 (Primary) → Position 1 (More)
  //
  // 5. HELPER FUNCTIONS:
  //    - getNavigationByPosition(view, position): Get items at specific position
  //    - getNavigationByType(view, type): Get items by type (primary, more, etc.)
  //    - getNavigationItemByLabel(label): Find specific item by label
  //    - getNavigationItemsWithPosition(view): Get all items with position info
  //
  // Desktop Navigation Array - HUSHH PDA Routes
  const desktopNavigation = [
    {
      position: 0,
      label: "Docs",
      href: "/docs",
      icon: FileTextIcon,
      type: "primary",
    },
    {
      position: 1,
      label: "Dashboard",
      href: "/dashboard",
      icon: ChartBar,
      type: "primary",
    },
    {
      position: 2,
      label: "Login",
      href: "/login",
      icon: UsersThreeIcon,
      type: "cta",
    },
    {
      position: 3,
      label: "Logout",
      href: "/logout",
      icon: SparkleIcon,
      type: "cta",
    },
    { position: 4, label: "Theme", href: "#", icon: null, type: "theme" },
  ];

  // Mobile Navigation Array - HUSHH PDA Routes
  const mobileNavigation = [
    {
      position: 0,
      label: "Docs",
      href: "/docs",
      icon: FileTextIcon,
      type: "primary",
    },
    {
      position: 1,
      label: "Dashboard",
      href: "/dashboard",
      icon: ChartBar,
      type: "primary",
    },
    {
      position: 2,
      label: "Login",
      href: "/login",
      icon: UsersThreeIcon,
      type: "cta",
    },
    {
      position: 3,
      label: "Logout",
      href: "/logout",
      icon: SparkleIcon,
      type: "cta",
    },
    {
      position: 4,
      label: "Theme",
      href: "#",
      icon: null,
      isThemeToggle: true,
      type: "theme",
    },
  ];

  // Legacy configuration for backward compatibility
  const navigationConfig = {
    // Desktop primary navigation pills (always visible)
    desktopPrimary: desktopNavigation
      .filter((item) => item.type === "primary")
      .map((item) => item.label),

    // Desktop "More" dropdown items
    desktopMore: desktopNavigation
      .filter((item) => item.type === "more")
      .map((item) => item.label),

    // Mobile primary navigation pills (always visible)
    mobilePrimary: mobileNavigation
      .filter((item) => item.type === "primary")
      .map((item) => item.label),

    // Mobile "More" dropdown items
    mobileMore: mobileNavigation
      .filter((item) => item.type === "more")
      .map((item) => item.label),

    // Routes that should highlight the "More" button when active (view-specific)
    moreRoutes: {
      desktop: [
        "/about",
        "/clients",
        "/innovation",
        "/genzdealz-ai",
        "/privacy-policy",
      ],
      mobile: [
        "/about",
        "/clients",
        "/innovation",
        "/genzdealz-ai",
        "/privacy-policy",
        "/schedule-demo",
        "/bank-partnerships",
        "/contact",
      ],
    },

    // Breadcrumb sections and their child pages
    breadcrumbSections: {
      "/more": [
        { href: "/about", label: "About" },
        { href: "/innovation", label: "Agilewiz AI" },
        { href: "/bank-partnerships", label: "Bank Partnerships" },
        { href: "/clients", label: "Clients" },
        { href: "/contact", label: "Contact" },
        { href: "/genzdealz-ai", label: "genzdealz AI" },
        { href: "/privacy-policy", label: "Privacy Policy" },
        { href: "/schedule-demo", label: "Schedule Demo" },
      ],
      "/more-desktop": [
        { href: "/about", label: "About" },
        { href: "/innovation", label: "Agilewiz AI" },
        { href: "/clients", label: "Clients" },
        { href: "/genzdealz-ai", label: "genzdealz AI" },
        { href: "/privacy-policy", label: "Privacy Policy" },
      ],
      "/more-mobile": [
        { href: "/about", label: "About" },
        { href: "/innovation", label: "Agilewiz AI" },
        { href: "/bank-partnerships", label: "Bank Partnerships" },
        { href: "/clients", label: "Clients" },
        { href: "/contact", label: "Contact" },
        { href: "/genzdealz-ai", label: "genzdealz AI" },
        { href: "/privacy-policy", label: "Privacy Policy" },
        { href: "/schedule-demo", label: "Schedule Demo" },
      ],
      "/products": [
        {
          href: "/products/admission-management",
          label: "Admission Management",
          icon: GraduationCap,
          description:
            "Digitize your admission process with online forms and fee collection.",
        },
        {
          href: "/products/fee-collection",
          label: "Fee Collection",
          icon: ChartBar,
          description:
            "Streamline fee collection with integrated payment systems.",
        },
        {
          href: "/products/hrms-payroll",
          label: "HRMS & Payroll",
          icon: UsersThreeIcon,
          description:
            "Complete HR management with automated payroll processing.",
        },
        {
          href: "/products/portal-gad",
          label: "Portal & GAD",
          icon: BrowserIcon,
          description:
            "Digital portal for government and administrative services.",
        },
        {
          href: "/products/purchase-inventory",
          label: "Purchase & Stores Inventory",
          icon: BriefcaseIcon,
          description:
            "Manage procurement and inventory with automated workflows.",
        },
        {
          href: "/products/student-attendance",
          label: "Student Attendance",
          icon: CalendarDots,
          description:
            "Track student attendance with biometric and digital systems.",
        },
        {
          href: "/products/student-exams",
          label: "Student Exams & Results",
          icon: BookOpen,
          description:
            "Conduct exams and manage results with automated grading.",
        },
      ],
      "/e-governance": [
        { href: "/e-governance/agriculture", label: "Agriculture" },
        { href: "/e-governance/animal-husbandry", label: "Animal Husbandry" },
        { href: "/e-governance/education", label: "Education" },
        { href: "/e-governance/fisheries", label: "Fisheries" },
        {
          href: "/e-governance/government-finance",
          label: "Government & Finance",
        },
        { href: "/e-governance/medical-research", label: "Medical & Research" },
        {
          href: "/e-governance/tribal-department",
          label: "Tribal Department Scheme",
        },
      ],
    },

    // All available navigation items with their metadata
    allItems: [
      { href: "/", icon: HouseIcon, label: "Home" },
      { href: "/about", icon: InfoIcon, label: "About" },
      { href: "/contact", icon: PhoneIcon, label: "Contact" },

      { href: "/clients", icon: UsersThreeIcon, label: "Clients" },
      { href: "/innovation", icon: AtomIcon, label: "Agilewiz AI" },
      {
        href: "/privacy-policy",
        icon: ShieldCheckIcon,
        label: "Privacy Policy",
      },
      { href: "/genzdealz-ai", icon: ChartBar, label: "genzdealz AI" },
      {
        href: "/bank-partnerships",
        icon: BuildingsIcon,
        label: "Bank Partnerships",
      },
    ],
  };

  // ===== OPTIMIZED ROUTE CHECK =====
  // Memoize frequently used route check after navigationConfig is declared
  const isMoreRoute = useMemo(() => {
    const moreRoutes = isMobile
      ? navigationConfig.moreRoutes.mobile
      : navigationConfig.moreRoutes.desktop;
    return moreRoutes.includes(pathname);
  }, [isMobile, pathname]);

  // ===== IMPROVED BREADCRUMB LOGIC =====
  // Centralized breadcrumb mapping
  const breadcrumbMap: Record<string, string> = {
    "/": "Home",
    "/about": "About",
    "/products": "Products",
    "/products/admission-management": "Admission Management",
    "/products/student-attendance": "Student Attendance",
    "/products/fee-collection": "Fee Collection",
    "/products/student-exams": "Student Exams & Results",
    "/products/purchase-inventory": "Purchase & Stores Inventory",
    "/products/hrms-payroll": "HRMS & Payroll",
    "/products/portal-gad": "Portal GAD",
    "/innovation": "Agilewiz AI",
    "/contact": "Contact",

    "/clients": "Clients",
    "/genzdealz-ai": "genzdealz AI",
    "/privacy-policy": "Privacy Policy",
    "/schedule-demo": "Schedule Demo",
    "/bank-partnerships": "Bank Partnerships",
  };

  // Define which routes are actually clickable (have pages)
  const clickableRoutes = new Set([
    "/",
    "/about",
    "/e-governance/tribal-department",
    "/e-governance/government-finance",
    "/e-governance/medical-research",
    "/e-governance/animal-husbandry",
    "/e-governance/agriculture",
    "/e-governance/fisheries",
    "/products/admission-management",
    "/products/student-attendance",
    "/products/fee-collection",
    "/products/student-exams",
    "/products/purchase-inventory",
    "/products/hrms-payroll",
    "/products/portal-gad",
    "/innovation",
    "/contact",
    "/partners",
    "/clients",
    "/genzdealz-ai",
    "/privacy-policy",
    "/schedule-demo",
    "/bank-partnerships",
  ]);

  // Helper function to generate breadcrumb items using improved logic
  const generateBreadcrumbItems = (pathname: string) => {
    const segments = pathname.split("/").filter(Boolean);
    const items: Array<{
      href: string;
      label: string;
      isLast: boolean;
      isClickable: boolean;
    }> = [];

    // Check if we're in a "More" section
    // Use the appropriate routes based on the current context
    const desktopMoreRoutes = navigationConfig.moreRoutes.desktop;
    const mobileMoreRoutes = navigationConfig.moreRoutes.mobile;

    if (
      desktopMoreRoutes.includes(pathname) ||
      mobileMoreRoutes.includes(pathname)
    ) {
      // Add "More" as the parent section
      items.push({
        href: "/more",
        label: "More",
        isLast: false,
        isClickable: false,
      });

      // Add the current page
      const label =
        breadcrumbMap[pathname] ||
        segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
      items.push({
        href: pathname,
        label,
        isLast: true,
        isClickable: clickableRoutes.has(pathname),
      });
    } else if (pathname.startsWith("/products/")) {
      // Products section
      items.push({
        href: "/products",
        label: "Products",
        isLast: false,
        isClickable: false,
      });

      const label =
        breadcrumbMap[pathname] ||
        segments[1]?.charAt(0).toUpperCase() + segments[1]?.slice(1) ||
        "Product";
      items.push({
        href: pathname,
        label,
        isLast: true,
        isClickable: clickableRoutes.has(pathname),
      });
    } else if (pathname.startsWith("/e-governance/")) {
      // e-Governance section - same pattern as products
      items.push({
        href: "/e-governance",
        label: "e-Governance",
        isLast: false,
        isClickable: false,
      });

      const label =
        breadcrumbMap[pathname] ||
        segments[1]?.charAt(0).toUpperCase() + segments[1]?.slice(1) ||
        "e-Governance Page";
      items.push({
        href: pathname,
        label,
        isLast: true,
        isClickable: clickableRoutes.has(pathname),
      });
    } else {
      // Direct page
      const label =
        breadcrumbMap[pathname] ||
        segments[0]?.charAt(0).toUpperCase() + segments[0]?.slice(1) ||
        "Page";
      items.push({
        href: pathname,
        label,
        isLast: true,
        isClickable: clickableRoutes.has(pathname),
      });
    }

    return items;
  };

  // Helper function to get current section
  const getCurrentSection = (
    pathname: string,
    view: "desktop" | "mobile" = "mobile"
  ) => {
    // Use view-specific routes for section logic
    const moreRoutes =
      view === "desktop"
        ? navigationConfig.moreRoutes.desktop
        : navigationConfig.moreRoutes.mobile;

    if (moreRoutes.includes(pathname)) {
      return view === "desktop" ? "/more-desktop" : "/more-mobile";
    }
    if (pathname.startsWith("/products/")) {
      return "/products";
    }
    if (pathname.startsWith("/e-governance/")) {
      return "/e-governance";
    }
    return null;
  };

  // Helper function to get next page in current section
  const getNextPage = (
    pathname: string,
    view: "desktop" | "mobile" = "mobile"
  ) => {
    const currentSection = getCurrentSection(pathname, view);
    if (
      !currentSection ||
      !navigationConfig.breadcrumbSections[currentSection]
    ) {
      return null;
    }

    const sectionPages = navigationConfig.breadcrumbSections[currentSection];
    const currentIndex = sectionPages.findIndex(
      (page) => page.href === pathname
    );

    if (currentIndex === -1 || currentIndex === sectionPages.length - 1) {
      return null;
    }

    return sectionPages[currentIndex + 1];
  };

  // Helper function to get previous page in current section
  const getPreviousPage = (
    pathname: string,
    view: "desktop" | "mobile" = "mobile"
  ) => {
    const currentSection = getCurrentSection(pathname, view);
    if (
      !currentSection ||
      !navigationConfig.breadcrumbSections[currentSection]
    ) {
      return null;
    }

    const sectionPages = navigationConfig.breadcrumbSections[currentSection];
    const currentIndex = sectionPages.findIndex(
      (page) => page.href === pathname
    );

    if (currentIndex <= 0) {
      return null;
    }

    return sectionPages[currentIndex - 1];
  };

  // ===== DERIVED STATE =====
  const breadcrumbItems = generateBreadcrumbItems(pathname);

  // For mobile view - show breadcrumbs for items in "More" section
  const mobileSection = getCurrentSection(pathname, "mobile");
  const shouldShowMobileNavigation =
    mobileSection && navigationConfig.breadcrumbSections[mobileSection];
  const mobileNextPage = getNextPage(pathname, "mobile");
  const mobilePreviousPage = getPreviousPage(pathname, "mobile");

  // For desktop view - show breadcrumbs only for items that are actually in "More" section on desktop
  const desktopSection = getCurrentSection(pathname, "desktop");
  const shouldShowDesktopNavigation =
    desktopSection && navigationConfig.breadcrumbSections[desktopSection];
  const desktopNextPage = getNextPage(pathname, "desktop");
  const desktopPreviousPage = getPreviousPage(pathname, "desktop");

  // Use the centralized configuration instead of hardcoded arrays
  const allNavItems = navigationConfig.allItems;

  // ===== DYNAMIC NAVIGATION RENDERING FUNCTIONS =====
  // Get sorted navigation items by position (ascending order)
  const getSortedNavigationItems = (
    view: "desktop" | "mobile",
    type: "primary" | "more" | "cta" | "theme"
  ) => {
    const navigation =
      view === "desktop" ? desktopNavigation : mobileNavigation;

    // Filter items by type and sort by position
    return navigation
      .filter((item) => item.type === type)
      .sort((a, b) => a.position - b.position);
  };

  // Get primary navigation items (position 0) for rendering
  const getPrimaryNavigationItems = (view: "desktop" | "mobile") => {
    return getSortedNavigationItems(view, "primary");
  };

  // Get more navigation items (position 1) for rendering
  const getMoreNavigationItems = (view: "desktop" | "mobile") => {
    return getSortedNavigationItems(view, "more");
  };

  // ===== EXAMPLE USAGE OF NEW NAVIGATION ARRAYS =====
  //
  // // Get all primary navigation items for desktop
  // const desktopPrimary = getNavigationByType("desktop", "primary");
  //
  // // Get items at position 1 (More dropdown) for mobile
  // const mobileMore = getNavigationByPosition("mobile", 1);
  //
  // // Find specific item by label
  // const homeItem = getNavigationItemByLabel("Home");
  //
  // // Get all navigation with position info

  // ===== OPTIMIZED POPOVER STATE MANAGEMENT =====
  // Single state object for all popover states to reduce re-renders and simplify logic
  const [popoverStates, setPopoverStates] = useState({
    products: false,
    eGovernance: false,
    more: false,
  });

  // Track pending close timeouts
  const closeTimeouts = useRef<{ [key: string]: NodeJS.Timeout | null }>({
    products: null,
    eGovernance: null,
    more: null,
  });

  // Optimized setter that ensures only one popover is open at a time
  const setPopoverOpen = useCallback(
    (type: keyof typeof popoverStates, isOpen: boolean) => {
      // Clear any existing timeout for this popover
      if (closeTimeouts.current[type]) {
        clearTimeout(closeTimeouts.current[type]!);
        closeTimeouts.current[type] = null;
      }

      setPopoverStates({
        products: type === "products" ? isOpen : false,
        eGovernance: type === "eGovernance" ? isOpen : false,
        more: type === "more" ? isOpen : false,
      });
    },
    []
  );

  // Helper function to schedule delayed close
  const scheduleDelayedClose = useCallback(
    (type: keyof typeof popoverStates, delay: number = 150) => {
      // Clear any existing timeout
      if (closeTimeouts.current[type]) {
        clearTimeout(closeTimeouts.current[type]!);
      }

      // Schedule new timeout
      closeTimeouts.current[type] = setTimeout(() => {
        setPopoverOpen(type, false);
        closeTimeouts.current[type] = null;
      }, delay);
    },
    [setPopoverOpen]
  );

  // Extract individual states for easier access
  const {
    products: isProductsOpen,
    eGovernance: isEGovernanceOpen,
    more: isMoreOpen,
  } = popoverStates;

  // Check if any popover is open
  const isAnyPopoverOpen = isProductsOpen || isEGovernanceOpen || isMoreOpen;

  return (
    <>
      {/* Global backdrop for all dropup menus */}
      {isAnyPopoverOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55]"
          onClick={() => {
            if (isProductsOpen) setPopoverOpen("products", false);
            if (isEGovernanceOpen) setPopoverOpen("eGovernance", false);
            if (isMoreOpen) setPopoverOpen("more", false);
          }}
          aria-hidden="true"
        />
      )}

      {/* --- MOBILE NAVBAR (with navigation controls) --- */}
      {isMobile ? (
        <nav
          className="fixed bottom-4 left-0 right-0 z-[60] flex justify-center px-4 overflow-visible lg:hidden"
          style={{ "--navbar-pill-height": "80px" } as React.CSSProperties}
        >
          <div className="w-full flex flex-col gap-2 relative">
            {/* Navigation Controls - Mobile (only show when in a section with sibling pages) */}
            {shouldShowMobileNavigation && (
              <Card
                variant="none"
                effect="fill"
                className="px-3 py-2 rounded-full relative group bg-white dark:bg-gray-900 border border-gray-200/30 dark:border-gray-700/30 !shadow-none"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Back navigation */}
                  <div className="flex-1 min-w-0">
                    {mobilePreviousPage ? (
                      <Link
                        href={mobilePreviousPage.href}
                        className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                      >
                        <CaretRightIcon className="h-3 w-3 rotate-180 flex-shrink-0" />
                        <span className="truncate">
                          <GradientText>
                            {mobilePreviousPage.label}
                          </GradientText>
                        </span>
                      </Link>
                    ) : (
                      <div className="h-4" /> // Spacer to maintain layout
                    )}
                  </div>

                  {/* Current page indicator - removed to prevent overlapping */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Empty div to maintain layout spacing */}
                  </div>

                  {/* Next navigation */}
                  <div className="flex-1 min-w-0 flex justify-end">
                    {mobileNextPage ? (
                      <Link
                        href={mobileNextPage.href}
                        className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                      >
                        <span className="truncate">
                          <GradientText>{mobileNextPage.label}</GradientText>
                        </span>
                        <CaretRightIcon className="h-3 w-3 flex-shrink-0" />
                      </Link>
                    ) : (
                      <div className="h-4" /> // Spacer to maintain layout
                    )}
                  </div>
                </div>
              </Card>
            )}

            <Card
              variant="none"
              effect="fill"
              className="flex items-stretch justify-between px-0 py-0 h-[var(--navbar-pill-height)] rounded-full relative group bg-white dark:bg-gray-900 border border-gray-200/30 dark:border-gray-700/30 !shadow-none"
            >
              {/* Modern design indicator - subtle glow on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="flex flex-1 items-center justify-between gap-x-1 rounded-full overflow-hidden">
                {/* Mobile Primary Navigation - using dynamic position-based logic */}
                {getPrimaryNavigationItems("mobile").map((item) => {
                  // Special handling for Integrated University Management System (has popover)
                  if (
                    item.label === "Integrated University Management System"
                  ) {
                    return (
                      <Popover
                        key={item.href}
                        open={isProductsOpen}
                        onOpenChange={(open) =>
                          setPopoverOpen("products", open)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="link"
                            effect="fill"
                            size="default"
                            className="flex flex-col items-center justify-center flex-1 min-w-0 py-1 h-full rounded-none shadow-none"
                            title={item.label}
                            showRipple={false}
                          >
                            <QrCodeIcon
                              className={`h-6 w-6 mb-1 ${
                                pathname.startsWith("/products/")
                                  ? getColorClass("primary", "start")
                                  : ""
                              }`}
                              weight={
                                pathname.startsWith("/products/")
                                  ? "duotone"
                                  : iconWeight
                              }
                            />
                            <span
                              className={`text-xs font-medium truncate flex items-center justify-center mt-1.5 ${
                                pathname.startsWith("/products/")
                                  ? "text-transparent bg-clip-text " +
                                    getGradientClasses("primary")
                                  : ""
                              }`}
                            >
                              IUMS
                              <CaretUpIcon
                                className={`h-4 w-4 ml-1 transition-transform duration-200 ${
                                  isProductsOpen ? "rotate-180" : "rotate-0"
                                } ${
                                  pathname.startsWith("/products/")
                                    ? getColorClass("primary", "start")
                                    : ""
                                }`}
                                aria-hidden="true"
                              />
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <>
                          <div
                            className={cn(
                              "fixed left-2 right-2 mx-auto max-w-lg bg-popover text-popover-foreground shadow-lg border rounded-2xl p-2 z-[110] transition-all duration-200 ease-out",
                              isProductsOpen
                                ? "translate-y-0 opacity-100"
                                : "translate-y-8 opacity-0 pointer-events-none"
                            )}
                            style={{
                              bottom: "calc(var(--navbar-pill-height) + 56px)",
                            }}
                          >
                            <ul className="grid gap-0.5 grid-cols-1 auto-rows-fr">
                              {/* Admission Management */}
                              <li className="h-full">
                                <Link
                                  href="/products/admission-management"
                                  onClick={() =>
                                    setPopoverOpen("products", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    isPathActive(
                                      "/products/admission-management"
                                    )
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive(
                                        "/products/admission-management"
                                      )
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <GraduationCap className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      Admission Management
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Digitize your admission process with
                                      online forms and fee collection.
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Fee Collection with Accounts & Finance */}
                              <li className="h-full">
                                <Link
                                  href="/products/fee-collection"
                                  onClick={() =>
                                    setPopoverOpen("products", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname === "/products/fee-collection"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive("/products/fee-collection")
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <ChartBar className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      Fee Collection with Accounts & Finance
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Collect fees and manage accounts with
                                      seamless integration.
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* HRMS & Payroll */}
                              <li className="h-full">
                                <Link
                                  href="/products/hrms-payroll"
                                  onClick={() =>
                                    setPopoverOpen("products", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname === "/products/hrms-payroll"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive("/products/hrms-payroll")
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <UsersThreeIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      HRMS & Payroll
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Manage HR, payroll, and staff records with
                                      ease.
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Portal & GAD */}
                              <li className="h-full">
                                <Link
                                  href="/products/portal-gad"
                                  onClick={() =>
                                    setPopoverOpen("products", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname === "/products/portal-gad"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive("/products/portal-gad")
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <BrowserIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      Portal & GAD
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Student and staff portals with GAD
                                      integration.
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Purchase & Stores Inventory */}
                              <li className="h-full">
                                <Link
                                  href="/products/purchase-inventory"
                                  onClick={() =>
                                    setPopoverOpen("products", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname === "/products/purchase-inventory"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive(
                                        "/products/purchase-inventory"
                                      )
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <BriefcaseIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      Purchase & Stores Inventory
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Streamline purchasing and inventory for
                                      your institution.
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Student Attendance */}
                              <li className="h-full">
                                <Link
                                  href="/products/student-attendance"
                                  onClick={() =>
                                    setPopoverOpen("products", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname === "/products/student-attendance"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive(
                                        "/products/student-attendance"
                                      )
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <CalendarDots className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      Student Attendance
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Track and manage student attendance
                                      efficiently.
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Student Exams & Results */}
                              <li className="h-full">
                                <Link
                                  href="/products/student-exams"
                                  onClick={() =>
                                    setPopoverOpen("products", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname === "/products/student-exams"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive("/products/student-exams")
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <BookOpen className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      Student Exams & Results
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Manage exams, results, and student
                                      performance online.
                                    </span>
                                  </div>
                                </Link>
                              </li>
                            </ul>
                          </div>
                        </>
                        {/* Desktop PopoverContent remains unchanged */}
                        {!isMobile && (
                          <PopoverContent
                            side="top"
                            align="center"
                            className="bg-popover text-popover-foreground shadow-lg border rounded-2xl w-[99vw] max-w-[320px] p-1 z-[110]"
                          >
                            {/* HUSHH: Removed hardcoded More items
                            <ul className="grid gap-0.5 grid-cols-1 auto-rows-fr">
                              {allNavItems
                                .filter((item) =>
                                  [
                                    "Agilewiz AI",
                                    "Bank Partnerships",
                                    "Blog",
                                    "Clients",
                                    "genzdealz AI",
                                    "Partners",
                                    "Privacy Policy",
                                  ].includes(item.label)
                                )
                                .map((item) => (
                                  <li className="h-full" key={item.href}>
                                    <Link
                                      href={item.href}
                                      className={cn(
                                        "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                        isPathActive(item.href)
                                          ? "bg-accent/20 border border-primary/20"
                                          : "hover:bg-accent"
                                      )}
                                    >
                                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted group-hover:bg-accent/20">
                                        {item.icon &&
                                          React.createElement(item.icon, {
                                            className: "h-4 w-4 text-primary",
                                          })}
                                      </div>
                                      <div className="flex flex-col justify-center">
                                        <span className="text-xs font-semibold leading-tight">
                                          {item.label}
                                        </span>
                                      </div>
                                    </Link>
                                  </li>
                                ))}
                              <li className="h-full">
                                <Link
                                  href="/schedule-demo"
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    isPathActive("/schedule-demo")
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted group-hover:bg-accent/20">
                                    <SparkleIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      Schedule Demo
                                    </span>
                                  </div>
                                </Link>
                              </li>
                            </ul>
                            */}
                          </PopoverContent>
                        )}
                      </Popover>
                    );
                  }
                  // Special handling for e-Governance (has popover)
                  if (item.label === "e-Governance") {
                    return (
                      <Popover
                        key={item.href}
                        open={isEGovernanceOpen}
                        onOpenChange={(open) =>
                          setPopoverOpen("eGovernance", open)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="link"
                            effect="fill"
                            size="default"
                            className="flex flex-col items-center justify-center flex-1 min-w-0 py-1 h-full rounded-none shadow-none"
                            title={item.label}
                            showRipple={false}
                          >
                            <FileTextIcon
                              className={`h-6 w-6 mb-1 ${
                                pathname.startsWith("/e-governance/")
                                  ? getColorClass("primary", "start")
                                  : ""
                              }`}
                              weight={
                                pathname.startsWith("/e-governance/")
                                  ? "duotone"
                                  : iconWeight
                              }
                            />
                            <span
                              className={`text-xs font-medium truncate flex items-center justify-center mt-1.5 ${
                                pathname.startsWith("/e-governance/")
                                  ? "text-transparent bg-clip-text " +
                                    getGradientClasses("primary")
                                  : ""
                              }`}
                            >
                              {item.label}
                              <CaretUpIcon
                                className={`h-4 w-4 ml-1 transition-transform duration-200 ${
                                  isEGovernanceOpen ? "rotate-180" : "rotate-0"
                                } ${
                                  pathname.startsWith("/e-governance/")
                                    ? getColorClass("primary", "start")
                                    : ""
                                }`}
                                aria-hidden="true"
                              />
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <>
                          <div
                            className={cn(
                              "fixed left-2 right-2 mx-auto max-w-lg bg-popover text-popover-foreground shadow-lg border rounded-2xl p-2 z-[110] transition-all duration-200 ease-out",
                              isEGovernanceOpen
                                ? "translate-y-0 opacity-100"
                                : "translate-y-8 opacity-0 pointer-events-none"
                            )}
                            style={{
                              bottom: "calc(var(--navbar-pill-height) + 56px)",
                            }}
                          >
                            <ul className="grid gap-0.5 grid-cols-1 auto-rows-fr">
                              {/* Agriculture */}
                              <li className="h-full">
                                <Link
                                  href="/e-governance/agriculture"
                                  onClick={() =>
                                    setPopoverOpen("eGovernance", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname === "/e-governance/agriculture"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive("/e-governance/agriculture")
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <PlantIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center min-w-0">
                                    <span className="text-xs font-semibold leading-tight flex items-center gap-1 min-w-0">
                                      <span className="truncate">
                                        Agriculture
                                      </span>
                                      <span
                                        className={`shrink-0 ml-1 ${getBadgeClasses("primary", "sm")}`}
                                      >
                                        Under Construction
                                      </span>
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Farming & agricultural development
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Animal Husbandry */}
                              <li className="h-full">
                                <Link
                                  href="/e-governance/animal-husbandry"
                                  onClick={() =>
                                    setPopoverOpen("eGovernance", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname ===
                                      "/e-governance/animal-husbandry"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive(
                                        "/e-governance/animal-husbandry"
                                      )
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <PawPrintIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center min-w-0">
                                    <span className="text-xs font-semibold leading-tight flex items-center gap-1 min-w-0">
                                      <span className="truncate">
                                        Animal Husbandry
                                      </span>
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Livestock & veterinary services
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Fisheries */}
                              <li className="h-full">
                                <Link
                                  href="/e-governance/fisheries"
                                  onClick={() =>
                                    setPopoverOpen("eGovernance", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname === "/e-governance/fisheries"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive("/e-governance/fisheries")
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <FishSimpleIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-xs font-semibold leading-tight">
                                      Fisheries
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Vessel registration & fishing practices
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Government & Finance */}
                              <li className="h-full">
                                <Link
                                  href="/e-governance/government-finance"
                                  onClick={() =>
                                    setPopoverOpen("eGovernance", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname ===
                                      "/e-governance/government-finance"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive(
                                        "/e-governance/government-finance"
                                      )
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <CurrencyCircleDollarIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center min-w-0">
                                    <span className="text-xs font-semibold leading-tight flex items-center gap-1 min-w-0">
                                      <span className="truncate">
                                        Government & Finance
                                      </span>
                                      <span
                                        className={`shrink-0 ml-1 ${getBadgeClasses("primary", "sm")}`}
                                      >
                                        Under Construction
                                      </span>
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Government operations & finance
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Medical & Research */}
                              <li className="h-full">
                                <Link
                                  href="/e-governance/medical-research"
                                  onClick={() =>
                                    setPopoverOpen("eGovernance", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname ===
                                      "/e-governance/medical-research"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive(
                                        "/e-governance/medical-research"
                                      )
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <HeartIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center min-w-0">
                                    <span className="text-xs font-semibold leading-tight flex items-center gap-1 min-w-0">
                                      <span className="truncate">
                                        Medical & Research
                                      </span>
                                      <span
                                        className={`shrink-0 ml-1 ${getBadgeClasses("primary", "sm")}`}
                                      >
                                        Under Construction
                                      </span>
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Healthcare & research management
                                    </span>
                                  </div>
                                </Link>
                              </li>
                              {/* Tribal Department Scheme */}
                              <li className="h-full">
                                <Link
                                  href="/e-governance/tribal-department"
                                  onClick={() =>
                                    setPopoverOpen("eGovernance", false)
                                  }
                                  className={cn(
                                    "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                    pathname ===
                                      "/e-governance/tribal-department"
                                      ? "bg-accent/20 border border-primary/20"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                                      isPathActive(
                                        "/e-governance/tribal-department"
                                      )
                                        ? "bg-primary/20"
                                        : "bg-muted group-hover:bg-accent/20"
                                    )}
                                  >
                                    <UsersThreeIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col justify-center min-w-0">
                                    <span className="text-xs font-semibold leading-tight flex items-center gap-1 min-w-0">
                                      <span className="truncate">
                                        Tribal Department Scheme
                                      </span>
                                      {/* Badge removed per request */}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Comprehensive scheme management for tribal
                                      welfare
                                    </span>
                                  </div>
                                </Link>
                              </li>
                            </ul>
                          </div>
                        </>
                      </Popover>
                    );
                  }

                  // Default handling for other items (Home, About)
                  return (
                    <Button
                      key={item.href}
                      variant="link"
                      effect="fill"
                      size="default"
                      className="relative flex flex-col items-center justify-center flex-1 min-w-0 py-1 h-[calc(var(--navbar-pill-height)+8px)] -my-1 rounded-none shadow-none"
                      title={item.label}
                      showRipple={false}
                    >
                      <Link
                        href={item.href}
                        aria-label={item.label}
                        className="flex flex-col items-center w-full"
                      >
                        {item.icon &&
                          React.createElement(item.icon, {
                            className: `h-6 w-6 mt-1 mb-1 ${
                              isPathActive(item.href)
                                ? getColorClass("primary", "start")
                                : ""
                            }`,
                            weight: isPathActive(item.href)
                              ? "duotone"
                              : iconWeight,
                          })}
                        <span
                          className={`text-xs font-medium truncate mt-1 ${
                            isPathActive(item.href)
                              ? "text-transparent bg-clip-text " +
                                getGradientClasses("primary")
                              : ""
                          }`}
                        >
                          {item.label}
                        </span>
                      </Link>
                    </Button>
                  );
                })}

                {/* More Popover */}
                <Popover
                  open={isMoreOpen}
                  onOpenChange={(open) => setPopoverOpen("more", open)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="link"
                      effect="fill"
                      size="default"
                      className="relative flex flex-col items-center justify-center flex-1 min-w-0 py-1 h-[calc(var(--navbar-pill-height)+8px)] -my-1 rounded-none shadow-none"
                      title="More"
                      showRipple={false}
                    >
                      <DotsThreeIcon
                        className={`h-6 w-6 mb-1 ${
                          isMoreRoute ? getColorClass("primary", "start") : ""
                        }`}
                        weight={iconWeight}
                      />
                      <span
                        className={`text-xs font-medium truncate flex items-center justify-center mt-1.5 ${
                          isMoreRoute
                            ? "text-transparent bg-clip-text " +
                              getGradientClasses("primary")
                            : ""
                        }`}
                      >
                        More
                        <CaretUpIcon
                          className={`h-4 w-4 ml-1 transition-transform duration-200 ${
                            isMoreOpen ? "rotate-180" : "rotate-0"
                          } ${
                            isMoreRoute ? getColorClass("primary", "start") : ""
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <>
                    <div
                      className={cn(
                        "fixed left-2 right-2 mx-auto max-w-lg bg-popover text-popover-foreground shadow-lg border rounded-2xl p-2 z-[110] transition-all duration-200 ease-out",
                        isMobile && isMoreOpen
                          ? "translate-y-0 opacity-100"
                          : "translate-y-8 opacity-0 pointer-events-none"
                      )}
                      style={{
                        bottom: "calc(var(--navbar-pill-height) + 56px)",
                      }}
                    >
                      <ul className="grid gap-0.5 grid-cols-1 auto-rows-fr">
                        {getMoreNavigationItems("mobile").map((item) => {
                          // Skip theme toggle as it's handled separately
                          if ("isThemeToggle" in item && item.isThemeToggle)
                            return null;

                          return (
                            <li className="h-full" key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setPopoverOpen("more", false)}
                                className={cn(
                                  "group grid grid-cols-[28px_1fr] items-center gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                  isPathActive(item.href)
                                    ? "bg-accent/20 border border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted group-hover:bg-accent/20 transition-colors">
                                  {item.icon &&
                                    React.createElement(item.icon, {
                                      className: "h-4 w-4 text-primary",
                                    })}
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                  <span className="text-xs font-semibold leading-tight truncate">
                                    {item.label}
                                  </span>
                                  {(item as any).underConstruction && (
                                    <span
                                      className={`mt-0.5 inline-flex items-center ${getBadgeClasses("primary", "sm")} w-fit`}
                                    >
                                      Under Construction
                                    </span>
                                  )}
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex items-center justify-between border-t px-4 py-3 mt-1">
                        <Link
                          href="/schedule-demo"
                          onClick={() => setPopoverOpen("more", false)}
                        >
                          <Button
                            variant={
                              pathname === "/schedule-demo"
                                ? "multi"
                                : "gradient"
                            }
                            effect={
                              pathname === "/schedule-demo" ? "fill" : "fade"
                            }
                            size="sm"
                            showRipple
                            title="Schedule Demo"
                          >
                            Schedule Demo
                          </Button>
                        </Link>
                        <div className="flex items-center justify-center">
                          <ThemeToggle />
                        </div>
                      </div>
                    </div>
                  </>
                  {/* Desktop PopoverContent remains unchanged */}
                  {!isMobile && (
                    <PopoverContent
                      side="top"
                      align="center"
                      className="bg-popover text-popover-foreground shadow-lg border rounded-2xl w-[99vw] max-w-[320px] p-1 z-[110]"
                    >
                      <ul className="grid gap-0.5 grid-cols-1 auto-rows-fr">
                        {allNavItems
                          .filter((item) =>
                            [
                              "Agilewiz AI",
                              "Bank Partnerships",
                              "Blog",
                              "Clients",
                              "GENZDEALZ.AI",
                              "Partners",
                              "Privacy Policy",
                            ].includes(item.label)
                          )
                          .map((item) => (
                            <li className="h-full" key={item.href}>
                              <Link
                                href={item.href}
                                className={cn(
                                  "group grid grid-cols-[28px_1fr] items-start gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                                  isPathActive(item.href)
                                    ? "bg-accent/20 border border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted group-hover:bg-accent/20 transition-colors">
                                  {item.icon &&
                                    React.createElement(item.icon, {
                                      className: "h-4 w-4 text-primary",
                                    })}
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-xs font-semibold leading-tight">
                                    {item.label}
                                  </span>
                                </div>
                              </Link>
                            </li>
                          ))}
                        <li className="h-full">
                          <Link
                            href="/schedule-demo"
                            className={cn(
                              "group grid grid-cols-[28px_1fr] items-start gap-x-1 px-1 py-1 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full",
                              pathname === "/schedule-demo"
                                ? "bg-accent/20 border border-primary/20"
                                : "hover:bg-accent"
                            )}
                          >
                            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted group-hover:bg-accent/20 transition-colors">
                              <SparkleIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex flex-col justify-center">
                              <span className="text-xs font-semibold leading-tight">
                                Schedule Demo
                              </span>
                            </div>
                          </Link>
                        </li>
                      </ul>
                    </PopoverContent>
                  )}
                </Popover>
              </div>
            </Card>
          </div>
        </nav>
      ) : (
        /* --- DESKTOP NAVBAR --- */
        <nav className="fixed bottom-4 left-0 right-0 z-[60] flex justify-center px-4 overflow-visible">
          {/* Desktop Navbar with mini breadcrumb pill (Back/Next) */}
          <div className="w-full max-w-6xl mx-auto hidden lg:flex flex-col gap-2 relative">
            {shouldShowDesktopNavigation && (
              <Card
                variant="none"
                effect="fill"
                className="px-4 py-2 rounded-full relative group bg-white dark:bg-gray-900 border border-gray-200/30 dark:border-gray-700/30 !shadow-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="flex items-center justify-between gap-4">
                  {/* Back */}
                  <div className="flex-1 min-w-0">
                    {desktopPreviousPage ? (
                      <Link
                        href={desktopPreviousPage.href}
                        className="flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
                      >
                        <CaretRightIcon className="h-3 w-3 rotate-180 flex-shrink-0" />
                        <span className="truncate max-w-[150px]">
                          <GradientText>
                            {desktopPreviousPage.label}
                          </GradientText>
                        </span>
                      </Link>
                    ) : (
                      <div className="h-5" /> // Spacer to maintain layout
                    )}
                  </div>

                  {/* Current - always centered */}
                  <div className="flex items-center gap-2 flex-shrink-0 max-w-[300px]">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                    <span className="text-sm font-medium truncate min-w-0">
                      <GradientText>
                        {breadcrumbItems[breadcrumbItems.length - 1]?.label}
                      </GradientText>
                    </span>
                  </div>

                  {/* Next */}
                  <div className="flex-1 min-w-0 flex justify-end">
                    {desktopNextPage ? (
                      <Link
                        href={desktopNextPage.href}
                        className="flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
                      >
                        <span className="truncate max-w-[150px]">
                          <GradientText>{desktopNextPage.label}</GradientText>
                        </span>
                        <CaretRightIcon className="h-3 w-3 flex-shrink-0" />
                      </Link>
                    ) : (
                      <div className="h-5" /> // Spacer to maintain layout
                    )}
                  </div>
                </div>
              </Card>
            )}
            {/* Navigation section */}
            <Card
              variant="none"
              effect="fill"
              className="flex items-center justify-between px-4 py-2 rounded-full relative group bg-white dark:bg-gray-900 border border-gray-200/30 dark:border-gray-700/30 !shadow-none"
            >
              {/* Modern design indicator - subtle glow on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              {/* Left side - Navigation items */}
              <div className="flex items-center gap-x-2">
                {/* Primary Navigation Items - using dynamic position-based logic */}
                {getPrimaryNavigationItems("desktop").map((item) => {
                  // Special handling for Integrated University Management System (has popover)
                  if (
                    item.label === "Integrated University Management System"
                  ) {
                    const isOnProductPage = pathname.startsWith("/products/");
                    return (
                      <Popover
                        key={item.href}
                        open={isProductsOpen}
                        onOpenChange={(open) =>
                          setPopoverOpen("products", open)
                        }
                      >
                        <PopoverTrigger asChild>
                          <div className="relative">
                            <Button
                              variant={isOnProductPage ? "multi" : "link"}
                              effect="fill"
                              size="default"
                              className="flex items-center gap-2 group"
                              showRipple={false}
                              onMouseEnter={() =>
                                setPopoverOpen("products", true)
                              }
                              onMouseLeave={() => {
                                scheduleDelayedClose("products");
                              }}
                              tabIndex={0}
                              aria-haspopup="menu"
                              aria-expanded={isProductsOpen ? true : false}
                            >
                              <QrCodeIcon
                                className="h-5 w-5"
                                weight={isOnProductPage ? "duotone" : "regular"}
                              />
                              <span className="text-base font-medium">
                                IUMS
                              </span>
                              <CaretUpIcon
                                className={`h-4 w-4 transition-transform duration-200 ml-1 ${
                                  isProductsOpen ? "rotate-180" : "rotate-0"
                                }`}
                                aria-hidden="true"
                              />
                            </Button>
                            {/* Invisible bridge to connect trigger to dropdown */}
                            {isProductsOpen && (
                              <div
                                className="absolute top-full left-0 right-0 h-1 bg-transparent pointer-events-none"
                                style={{ zIndex: 100 }}
                                onMouseEnter={() => {
                                  // Cancel any pending close when entering bridge
                                  if (closeTimeouts.current.products) {
                                    clearTimeout(
                                      closeTimeouts.current.products
                                    );
                                    closeTimeouts.current.products = null;
                                  }
                                  setPopoverOpen("products", true);
                                }}
                              />
                            )}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          side="top"
                          align="start"
                          className="bg-popover text-popover-foreground shadow-lg border rounded-md w-[640px] p-6 z-[110]"
                          onMouseEnter={() => {
                            // Cancel any pending close when entering dropdown
                            if (closeTimeouts.current.products) {
                              clearTimeout(closeTimeouts.current.products);
                              closeTimeouts.current.products = null;
                            }
                            setPopoverOpen("products", true);
                          }}
                          onMouseLeave={() => {
                            scheduleDelayedClose("products");
                          }}
                        >
                          <ul className="grid gap-2 md:grid-cols-2 auto-rows-fr">
                            {/* Admission Management */}
                            <li className="h-full">
                              <Link
                                href="/products/admission-management"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/products/admission-management"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname ===
                                      "/products/admission-management"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <GraduationCap className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-base font-semibold leading-tight">
                                    Admission Management
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Digitize your admission process with online
                                    forms and fee collection.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Fee Collection with Accounts & Finance */}
                            <li className="h-full">
                              <Link
                                href="/products/fee-collection"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/products/fee-collection"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname === "/products/fee-collection"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <ChartBar className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-base font-semibold leading-tight">
                                    Fee Collection with Accounts & Finance
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Collect fees and manage accounts with
                                    seamless integration.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* HRMS & Payroll */}
                            <li className="h-full">
                              <Link
                                href="/products/hrms-payroll"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/products/hrms-payroll"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname === "/products/hrms-payroll"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <UsersThreeIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-base font-semibold leading-tight">
                                    HRMS & Payroll
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Manage HR, payroll, and staff records with
                                    ease.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Portal & GAD */}
                            <li className="h-full">
                              <Link
                                href="/products/portal-gad"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/products/portal-gad"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname === "/products/portal-gad"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <BrowserIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-base font-semibold leading-tight">
                                    Portal & GAD
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Student and staff portals with GAD
                                    integration.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Purchase & Stores Inventory */}
                            <li className="h-full">
                              <Link
                                href="/products/purchase-inventory"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/products/purchase-inventory"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname === "/products/purchase-inventory"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <BriefcaseIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-base font-semibold leading-tight">
                                    Purchase & Stores Inventory
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Streamline purchasing and inventory for your
                                    institution.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Student Attendance */}
                            <li className="h-full">
                              <Link
                                href="/products/student-attendance"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/products/student-attendance"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname === "/products/student-attendance"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <CalendarDots className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-base font-semibold leading-tight">
                                    Student Attendance
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Track and manage student attendance
                                    efficiently.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Student Exams & Results */}
                            <li className="h-full">
                              <Link
                                href="/products/student-exams"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/products/student-exams"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname === "/products/student-exams"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <BookOpen className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-base font-semibold leading-tight">
                                    Student Exams & Results
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Manage exams, results, and student
                                    performance online.
                                  </span>
                                </div>
                              </Link>
                            </li>
                          </ul>
                        </PopoverContent>
                      </Popover>
                    );
                  }
                  // Special handling for e-Governance (has popover)
                  if (item.label === "e-Governance") {
                    const isOnEGovernancePage =
                      pathname.startsWith("/e-governance/");
                    return (
                      <Popover
                        key={item.href}
                        open={isEGovernanceOpen}
                        onOpenChange={(open) =>
                          setPopoverOpen("eGovernance", open)
                        }
                      >
                        <PopoverTrigger asChild>
                          <div className="relative">
                            <Button
                              variant={isOnEGovernancePage ? "multi" : "link"}
                              effect="fill"
                              size="default"
                              className="flex items-center gap-2 group"
                              showRipple={false}
                              onMouseEnter={() =>
                                setPopoverOpen("eGovernance", true)
                              }
                              onMouseLeave={() => {
                                scheduleDelayedClose("eGovernance");
                              }}
                              tabIndex={0}
                              aria-haspopup="menu"
                              aria-expanded={isEGovernanceOpen ? true : false}
                            >
                              <FileTextIcon
                                className="h-5 w-5"
                                weight={
                                  isOnEGovernancePage ? "duotone" : "regular"
                                }
                              />
                              <span className="text-base font-medium">
                                e-Governance
                              </span>
                              <CaretUpIcon
                                className={`h-4 w-4 transition-transform duration-200 ml-1 ${
                                  isEGovernanceOpen ? "rotate-180" : "rotate-0"
                                }`}
                                aria-hidden="true"
                              />
                            </Button>
                            {/* Invisible bridge to connect trigger to dropdown */}
                            {isEGovernanceOpen && (
                              <div
                                className="absolute top-full left-0 right-0 h-1 bg-transparent pointer-events-none"
                                style={{ zIndex: 100 }}
                                onMouseEnter={() => {
                                  // Cancel any pending close when entering bridge
                                  if (closeTimeouts.current.eGovernance) {
                                    clearTimeout(
                                      closeTimeouts.current.eGovernance
                                    );
                                    closeTimeouts.current.eGovernance = null;
                                  }
                                  setPopoverOpen("eGovernance", true);
                                }}
                              />
                            )}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          side="top"
                          align="start"
                          className="bg-popover text-popover-foreground shadow-lg border rounded-md w-[640px] p-6 z-[110]"
                          onMouseEnter={() => {
                            // Cancel any pending close when entering dropdown
                            if (closeTimeouts.current.eGovernance) {
                              clearTimeout(closeTimeouts.current.eGovernance);
                              closeTimeouts.current.eGovernance = null;
                            }
                            setPopoverOpen("eGovernance", true);
                          }}
                          onMouseLeave={() => {
                            scheduleDelayedClose("eGovernance");
                          }}
                        >
                          <ul className="grid gap-2 md:grid-cols-2 auto-rows-fr">
                            {/* Agriculture */}
                            <li className="h-full">
                              <Link
                                href="/e-governance/agriculture"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/e-governance/agriculture"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname === "/e-governance/agriculture"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <PlantIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                  <span className="text-base font-semibold leading-tight min-w-0 block">
                                    Agriculture
                                  </span>
                                  <span
                                    className={`mt-1 inline-flex items-center ${getBadgeClasses("primary", "md")} w-fit`}
                                  >
                                    Under Construction
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Farming practices and agricultural
                                    development.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Animal Husbandry */}
                            <li className="h-full">
                              <Link
                                href="/e-governance/animal-husbandry"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/e-governance/animal-husbandry"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname ===
                                      "/e-governance/animal-husbandry"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <PawPrintIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                  <span className="text-base font-semibold leading-tight min-w-0 block">
                                    Animal Husbandry
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Livestock management and veterinary
                                    services.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Fisheries */}
                            <li className="h-full">
                              <Link
                                href="/e-governance/fisheries"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/e-governance/fisheries"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname === "/e-governance/fisheries"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <FishSimpleIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-base font-semibold leading-tight">
                                    Fisheries
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Vessel registration and sustainable fishing
                                    practices.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Government & Finance */}
                            <li className="h-full">
                              <Link
                                href="/e-governance/government-finance"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname ===
                                    "/e-governance/government-finance"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname ===
                                      "/e-governance/government-finance"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <CurrencyCircleDollarIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                  <span className="text-base font-semibold leading-tight min-w-0 block">
                                    Government & Finance
                                  </span>
                                  <span
                                    className={`mt-1 inline-flex items-center ${getBadgeClasses("primary", "md")} w-fit`}
                                  >
                                    Under Construction
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Streamline government operations and
                                    financial management.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Medical & Research */}
                            <li className="h-full">
                              <Link
                                href="/e-governance/medical-research"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/e-governance/medical-research"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname ===
                                      "/e-governance/medical-research"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <HeartIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                  <span className="text-base font-semibold leading-tight min-w-0 block">
                                    Medical & Research
                                  </span>
                                  <span
                                    className={`mt-1 inline-flex items-center ${getBadgeClasses("primary", "md")} w-fit`}
                                  >
                                    Under Construction
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Healthcare and research institution
                                    management solutions.
                                  </span>
                                </div>
                              </Link>
                            </li>
                            {/* Tribal Department Scheme */}
                            <li className="h-full">
                              <Link
                                href="/e-governance/tribal-department"
                                className={cn(
                                  "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                                  pathname === "/e-governance/tribal-department"
                                    ? "bg-accent/20 border-primary/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                    pathname ===
                                      "/e-governance/tribal-department"
                                      ? "bg-primary/20"
                                      : "bg-muted group-hover:bg-accent/20"
                                  )}
                                >
                                  <GraduationCap className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                  <span className="text-base font-semibold leading-tight min-w-0 block">
                                    Tribal Department Scheme
                                  </span>
                                  {/* Badge removed per request */}
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Schemes & fund disbursement management for
                                    tribal communities.
                                  </span>
                                </div>
                              </Link>
                            </li>
                          </ul>
                        </PopoverContent>
                      </Popover>
                    );
                  }

                  return (
                    <NavButton
                      key={item.href}
                      item={item}
                      isActive={isPathActive(item.href)}
                      isDesktop
                    />
                  );
                })}
                {/* More dropdown for less important links (cloned Products style) */}
                <Popover
                  open={isMoreOpen}
                  onOpenChange={(open) => setPopoverOpen("more", open)}
                >
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Button
                        variant={isMoreRoute ? "multi" : "link"}
                        effect="fill"
                        size="default"
                        className="flex items-center gap-2 group"
                        style={{ outline: "none !important" }}
                        showRipple={false}
                        onMouseEnter={() => setPopoverOpen("more", true)}
                        onMouseLeave={() => {
                          scheduleDelayedClose("more");
                        }}
                        tabIndex={0}
                        aria-haspopup="menu"
                        aria-expanded={isMoreOpen}
                      >
                        <DotsThreeIcon className="h-5 w-5" />
                        <span className="text-base font-medium">More</span>
                        <CaretUpIcon
                          className={`h-4 w-4 transition-transform duration-200 ml-1 ${
                            isMoreOpen ? "rotate-180" : "rotate-0"
                          }`}
                          aria-hidden="true"
                        />
                      </Button>
                      {/* Invisible bridge to connect trigger to dropdown */}
                      {isMoreOpen && (
                        <div
                          className="absolute top-full left-0 right-0 h-1 bg-transparent pointer-events-none"
                          style={{ zIndex: 100 }}
                          onMouseEnter={() => {
                            // Cancel any pending close when entering bridge
                            if (closeTimeouts.current.more) {
                              clearTimeout(closeTimeouts.current.more);
                              closeTimeouts.current.more = null;
                            }
                            setPopoverOpen("more", true);
                          }}
                        />
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="bg-popover text-popover-foreground shadow-lg border rounded-md w-[480px] p-6 z-[110]"
                    onMouseEnter={() => {
                      // Cancel any pending close when entering dropdown
                      if (closeTimeouts.current.more) {
                        clearTimeout(closeTimeouts.current.more);
                        closeTimeouts.current.more = null;
                      }
                      setPopoverOpen("more", true);
                    }}
                    onMouseLeave={() => {
                      scheduleDelayedClose("more");
                    }}
                  >
                    <ul className="grid gap-2 md:grid-cols-2 auto-rows-fr">
                      {getMoreNavigationItems("desktop").map((item) => (
                        <li className="h-full" key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "group grid grid-cols-[48px_1fr] items-center gap-x-4 px-4 py-4 rounded-lg transition-colors focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-full min-h-[84px] border border-transparent",
                              isPathActive(item.href)
                                ? "bg-accent/20 border-primary/20"
                                : "hover:bg-accent"
                            )}
                          >
                            <div
                              className={cn(
                                "flex items-center justify-center h-12 w-12 rounded-full transition-colors",
                                isPathActive(item.href)
                                  ? "bg-primary/20"
                                  : "bg-muted group-hover:bg-accent/20"
                              )}
                            >
                              {item.icon &&
                                React.createElement(item.icon, {
                                  className: "h-6 w-6 text-primary",
                                })}
                            </div>
                            <div className="flex flex-col justify-center h-12 min-w-0">
                              <span className="text-base font-semibold leading-tight min-w-0 block">
                                <span className="truncate block">
                                  {item.label}
                                </span>
                              </span>
                              {(item as any).underConstruction && (
                                <span
                                  className={`mt-1 inline-flex items-center ${getBadgeClasses("primary", "md")} w-fit`}
                                >
                                  Under Construction
                                </span>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-x-4">
                <Link href="/schedule-demo">
                  <Button
                    variant={
                      pathname === "/schedule-demo" ? "multi" : "gradient"
                    }
                    effect={pathname === "/schedule-demo" ? "fill" : "fade"}
                    size="default"
                    showRipple
                    aria-current={
                      pathname === "/schedule-demo" ? "page" : undefined
                    }
                    title="Schedule Demo"
                  >
                    Schedule Demo
                  </Button>
                </Link>
                <ThemeToggle />
                <Separator orientation="vertical" className="h-6" />
              </div>
            </Card>
          </div>
        </nav>
      )}
    </>
  );
};
