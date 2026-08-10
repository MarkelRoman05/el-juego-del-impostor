import { Routes } from "@angular/router";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { AdminService } from "./admin/admin.service";
import { AdminLoginComponent } from "./admin/admin-login.component";
import { AdminPanelComponent } from "./admin/admin-panel.component";

function adminGuard(): boolean {
  const admin = inject(AdminService);
  const router = inject(Router);
  if (admin.isAuthenticated()) {
    return true;
  }
  router.navigate(["/admin/login"]);
  return false;
}

export const routes: Routes = [
  { path: "admin/login", component: AdminLoginComponent },
  { path: "admin", component: AdminPanelComponent, canActivate: [adminGuard] },
];
