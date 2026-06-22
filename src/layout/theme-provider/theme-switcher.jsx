// app/components/theme-switcher.jsx
"use client";

import { Button } from "react-bootstrap";
import { useTheme } from "./theme-provider";
import { Moon, Sun } from "react-feather";

export function ThemeSwitcher() {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover" onClick={toggleTheme}>
            <span className="icon">
                <span className=" position-relative">
                    <span className="feather-icon">
                        {theme === "light" ? <Moon /> : <Sun />}
                    </span>
                </span>
            </span>
        </Button>
    );
}