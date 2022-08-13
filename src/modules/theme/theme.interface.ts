/*
 * @FilePath: /nx-core/src/modules/theme/theme.interface.ts
 * @author: Wibus
 * @Date: 2022-08-13 23:14:55
 * @LastEditors: Wibus
 * @LastEditTime: 2022-08-13 23:33:06
 * Coding With IU
 */

import { CategoryModel } from "../category/category.model";
import { SiteDto, ThemeDto, UrlsDto } from "../configs/configs.dto";
import { PageModel } from "../page/page.model";
import { PostModel } from "../post/post.model";

interface SiteThemeInterface {
  posts: PostModel[]; // 博客文章
  pages: PageModel[]; // 页面
  categories: CategoryModel[]; // 分类
  tags: CategoryModel[]; // 标签
}

interface ConfigsThemeInterface {
  urls: UrlsDto, // 站点地址
  site: SiteDto, // 站点设置
  theme: ThemeDto, // 主题设置
}

export interface ThemeBasicInterface {
  site: SiteThemeInterface, // 网站变量
  configs: ConfigsThemeInterface, // 网站配置
  page: PostModel | PageModel, // 针对该页面的内容
  path: string, // 页面路径
  url: string, // 页面url
}