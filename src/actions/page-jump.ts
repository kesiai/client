/**
 * 动作-页面跳转
 *
 * <Button onClick={() => pageJump({ url: "/test-form" })} />            — 站内（hash 路由）
 * <Button onClick={() => pageJump({ url: "https://...", openWay: "_blank" })} /> — 新开页
 */
import { toast } from "sonner";

export interface PageJumpOptions {
  /** 目标地址；站内地址走 hash 路由（#/url），http(s) 地址走 window.open */
  url: string;
  /** 打开方式，默认 _self */
  openWay?: "_blank" | "_self" | "_parent" | "_top";
}

export function pageJump({ url, openWay = "_self" }: PageJumpOptions) {
  if (!url) return;
  const isExternal = /^https?:\/\//i.test(url);
  if (isExternal || openWay !== "_self") {
    window.open(url, openWay);
  } else {
    // 项目为 hash 路由：#/path，直接改 hash 不刷新页面
    const normalized = url.startsWith("/") ? url : `/${url}`;
    window.location.hash = `#${normalized}`;
  }
  toast.info(`跳转 ${url}`);
}
