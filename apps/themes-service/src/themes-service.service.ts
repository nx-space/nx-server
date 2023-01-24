import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { join } from 'path';
import { ConfigService } from '~/libs/config/src';
import { ThemesDto } from '~/libs/config/src/config.dto';
import { THEME_DIR } from '~/shared/constants/path.constant';
import { consola } from '~/shared/global/consola.global';
import yaml from 'js-yaml';
import {
  ThemeConfig,
  ThemeConfigItemAll,
  ThemeConfigItemSelect,
  ThemeConfigType,
} from './theme.interface';
import fs from 'fs';
import { ServicesEnum } from '~/shared/constants/services.constant';
import { ClientProxy } from '@nestjs/microservices';
import { ThemesEvents } from '~/shared/constants/event.constant';

@Injectable()
export class ThemesServiceService {
  private env: {
    theme: string | undefined;
    [key: string]: any;
  };
  private themes: ThemesDto[];
  private dir: any[] = [];
  constructor(
    private readonly configService: ConfigService,
    @Inject(ServicesEnum.notification)
    private readonly notificationService: ClientProxy,
  ) {
    this.env = JSON.parse(process.env.MOG_PRIVATE_INNER_ENV || '{}')?.theme || {
      theme: undefined,
    };

    this.configService
      .get('themes')
      .then((themes) => {
        consola.info(`共加载了${themes?.length || 0}个主题配置`);
      })
      .then(() => {
        consola.info(`共检测到 ${fs.readdirSync(THEME_DIR).length} 个主题`);
      })
      .then(() => {
        fs.readdirSync(THEME_DIR).forEach((theme) => {
          this.validateTheme(theme, false);
        });
      })
      .then(() => {
        consola.success(
          `合法主题检测完毕，共检测到 ${this.dir.length} 个合法主题`,
        );
      });

    this._getAllThemes().then((themes) => {
      this.themes = themes;
      this.setENV(
        this.themes.filter((theme) => theme.active)[0]?.path ||
          this.dir?.[0]?.path,
      );
      this.trackThemeChange();
    });
  }

  /**
   * 追踪活动主题修改
   */
  async trackThemeChange() {
    if (this.env.theme) {
      const name = JSON.parse(
        fs.readFileSync(
          join(THEME_DIR, this.env.theme, 'package.json'),
          'utf-8',
        ),
      ).name;
      consola.info(`正在追踪主题 ${name} 配置文件的修改`);
      fs.watchFile(join(THEME_DIR, this.env.theme, 'config.yaml'), () => {
        this.validateTheme(this.env.theme!, false); // 重新验证主题
      });
    }
  }

  /**
   * 取消追踪主题修改
   */
  async untrackThemeChange() {
    if (this.env.theme) {
      const name = JSON.parse(
        fs.readFileSync(
          join(THEME_DIR, this.env.theme, 'package.json'),
          'utf-8',
        ),
      ).name;
      consola.info(`正在取消追踪主题 ${name} 配置文件的修改`);
      fs.unwatchFile(join(THEME_DIR, this.env.theme, 'config.yaml'));
    }
  }

  /**
   * 修改活动主题
   */
  async setENV(theme: string) {
    this.env.theme = theme;
    process.env.MOG_PRIVATE_INNER_ENV = JSON.stringify({
      ...this.env,
      theme,
    });
  }

  /**
   * 验证主题合法性
   */
  validateTheme(theme: string, error = true) {
    try {
      if (!fs.existsSync(join(THEME_DIR, theme))) {
        throw new InternalServerErrorException(`主题不存在`);
      }
      try {
        fs.accessSync(path.join(THEME_DIR, theme), fs.constants.R_OK);
      } catch (e) {
        throw new InternalServerErrorException(`主题目录无读取权限`);
      }
      let config: ThemeConfig;
      try {
        const configString = fs.readFileSync(
          join(THEME_DIR, theme, 'config.yaml'),
          'utf-8',
        );
        config = yaml.load(configString) as ThemeConfig;
      } catch (e) {
        throw new InternalServerErrorException(
          `主题配置文件读取失败, 请检查文件是否存在`,
        );
      }
      if (!config?.configs) {
        throw new InternalServerErrorException(
          `主题配置文件格式错误, configs 字段不存在`,
        );
      }
      config.configs.forEach((config) => {
        if (!config?.name) {
          throw new InternalServerErrorException(
            `主题配置文件格式错误, "${config?.name}" 字段中的 name 字段不存在`,
          );
        }
        if (!config?.type) {
          throw new InternalServerErrorException(
            `主题配置文件格式错误, "${
              (config as ThemeConfigItemAll)?.name
            }" 字段中的 type 字段不存在`,
          );
        }
        if (!Object.values(ThemeConfigType).includes(config.type)) {
          throw new InternalServerErrorException(
            `主题配置文件格式错误, "${config?.name}" 字段中的 type 字段不合法`,
          );
        }
        if (config.name.match(/[\u4e00-\u9fa5]/) && !config.key) {
          throw new InternalServerErrorException(
            `主题配置文件格式错误, "${config?.name}" 字段中的 key 字段不存在, 但是 name 字段是中文`,
          );
        }
        if (
          (config as ThemeConfigItemSelect).data &&
          (config as ThemeConfigItemSelect).data.length
        ) {
          (config as ThemeConfigItemSelect).data.forEach((data) => {
            if (data.name.match(/[\u4e00-\u9fa5]/) && !data.key) {
              throw new InternalServerErrorException(
                `主题配置文件格式错误, "${config?.name}" 字段中的 data 字段中的 "${data.name}" 字段中的 key 字段不存在, 但是 name 字段是中文`,
              );
            }
            if (!data.value) {
              throw new InternalServerErrorException(
                `主题配置文件格式错误, "${config?.name}" 字段中的 data 字段中的 "${data.name}" 字段中的 value 字段不存在`,
              );
            }
          });
        }
        if (!fs.existsSync(join(THEME_DIR, theme, 'package.json'))) {
          throw new InternalServerErrorException(`主题缺少 package.json 文件`);
        }
      });
    } catch (e) {
      if (error) {
        throw new InternalServerErrorException(`[${theme}] ${e.message}`);
      } else {
        consola.info(`${chalk.red(`[${theme}] ${e.message}`)}`);
        return false;
      }
    }
    this.dir.push(theme);
    this.dir = Array.from(new Set(this.dir)); // 去重
    return true;
  }

  /**
   * 获取主题大致信息
   * @param theme 主题 ID
   */
  async getTheme(id: string): Promise<ThemesDto> {
    const theme = this.dir.find((t) => t === id);
    if (!theme) {
      throw new InternalServerErrorException(`主题不存在或不合法`);
    }
    const config = fs.readFileSync(
      join(THEME_DIR, theme, 'config.yaml'),
      'utf-8',
    );
    const _package = JSON.parse(
      fs.readFileSync(join(THEME_DIR, theme, 'package.json'), 'utf-8'),
    );
    const _yaml = yaml.load(config) as ThemeConfig;
    return {
      id: _yaml.id,
      name: _package.name,
      active:
        (await this.configService.get('themes'))?.find((t) => t.id === _yaml.id)
          ?.active || false,
      package: JSON.stringify(_package),
      version: _package.version,
      config: JSON.stringify(_yaml.configs),
      path: theme,
    };
  }

  /**
   * 获取所有主题 (private)
   */
  private async _getAllThemes(): Promise<ThemesDto[]> {
    const themes: ThemesDto[] = [];
    const dirs = fs.readdirSync(THEME_DIR);
    for (const dir of dirs) {
      if (this.validateTheme(dir, false)) {
        themes.push(await this.getTheme(dir));
      }
    }
    return themes;
  }

  /**
   * 获取所有主题
   */
  getAllThemes() {
    return this.themes;
  }

  /**
   * 启动主题
   */
  async activeTheme(id: string): Promise<boolean> {
    this.notificationService.emit(ThemesEvents.ThemeBeforeActivate, { id });
    const themes = (await this.configService.get('themes')) || [];

    const activeTheme = themes?.find((t) => t.active);
    activeTheme?.active && (activeTheme.active = false);

    activeTheme &&
      this.notificationService.emit(ThemesEvents.ThemeBeforeDeactivate, {
        id: activeTheme.id,
      });

    const theme = themes?.find((t) => t.id === id);
    const _theme = this.themes?.find((t) => t.id === id);
    if (!_theme) {
      throw new InternalServerErrorException(`主题不存在或不合法`);
    }
    _theme.active = true;
    if (!theme) {
      await this.configService.patchAndValidate('seo', {
        ...(await this.configService.get('seo')),
      });

      await this.configService.patchAndValidate('themes', [
        ...themes.filter((t) => t.id !== activeTheme?.id),
        ...(activeTheme ? [activeTheme] : []),
        _theme,
      ]);
      return true;
    }
    theme.active = true;
    await this.configService.patchAndValidate('themes', [
      ...themes
        .filter((t) => t.id !== id)
        .filter((t) => t.id !== activeTheme?.id),
      _theme, // 重新获取一次, 防止配置文件被修改而无更新
    ]);
    this.setENV(_theme.path);
    this.untrackThemeChange(); // 取消旧主题的监听
    this.trackThemeChange(); // 监听新主题的变化

    activeTheme &&
      this.notificationService.emit(ThemesEvents.ThemeAfterDeactivate, {
        id: activeTheme.id,
      });
    this.notificationService.emit(ThemesEvents.ThemeAfterActivate, { id });
    return true;
  }

  /**
   * 删除主题
   */
  async deleteTheme(id: string): Promise<boolean> {
    this.notificationService.emit(ThemesEvents.ThemeBeforeUninstall, { id });
    const themes = (await this.configService.get('themes')) || [];
    const theme = themes?.find((t) => t.id === id);
    if (theme?.active) {
      throw new InternalServerErrorException(`无法删除正在使用的主题`);
    }
    const _theme = this.dir.find((t) => t === id);
    if (!_theme) {
      throw new InternalServerErrorException(`主题目录不存在`);
    }
    fs.rmdirSync(join(THEME_DIR, _theme), { recursive: true });
    this.dir = this.dir.filter((t) => t !== id);
    this.themes = this.themes.filter((t) => t.id !== id);
    consola.info(`主题 ${chalk.green(id)} 已删除`);
    this.notificationService.emit(ThemesEvents.ThemeAfterUninstall, { id });
    return true;
  }

  /**
   * 设置主题配置
   * @param id 主题 ID
   * @param config 主题配置
   */
  async updateThemeConfig(id: string, config: string): Promise<boolean> {
    try {
      const _c = JSON.parse(config);
      if (!Array.isArray(_c)) {
        throw new InternalServerErrorException(`主题配置不合法`);
      }
      _c.forEach((c) => {
        if (!c.name || !c.value) {
          throw new InternalServerErrorException(
            `主题配置不合法, 缺少 name 或 value`,
          );
        }
        if (c.name.match(/[\u4e00-\u9fa5]/) && !c.key) {
          throw new InternalServerErrorException(
            `主题配置不合法, 缺少 key, 但 name 中包含中文`,
          );
        }
      });
    } catch {
      throw new InternalServerErrorException(`主题配置不合法`);
    }
    const themes = (await this.configService.get('themes')) || [];
    const theme = themes?.find((t) => t.id === id);
    if (!theme) {
      throw new InternalServerErrorException(`主题不存在或不合法`);
    }
    theme.config = config;
    await this.configService.patchAndValidate('themes', [
      ...themes.filter((t) => t.id !== id),
      theme,
    ]);
    return true;
  }

  /**
   * 获取主题配置
   */
  async getThemeConfig(id: string): Promise<string> {
    return (
      JSON.parse(
        (await this.configService.get('themes'))?.find((t) => t.id === id)
          ?.config || '[]',
      ) || []
    );
  }

  /**
   * 获取主题某一配置
   * @param id 主题 ID
   * @param key 配置 key
   */
  async getThemeConfigItem(id: string, key: string): Promise<string> {
    const themes = (await this.configService.get('themes')) || [];
    const theme = themes?.find((t) => t.id === id);
    if (!theme) {
      throw new InternalServerErrorException(`主题配置不存在`);
    }
    const config = JSON.parse(theme.config || '[]') as ThemeConfigItemAll[];
    let c = config.find((c) => c.key === key);
    if (!c) {
      c = config.find((c) => c.name === key);
      if (!c) throw new InternalServerErrorException(`主题配置名不存在`);
    }
    return String(c?.value) || '';
  }

  /**
   * 设置主题某一配置
   * @param id 主题 ID
   * @param key 配置 key
   * @param value 配置 value
   */
  async updateThemeConfigItem(
    id: string,
    key: string,
    value: string,
  ): Promise<boolean> {
    const themes = (await this.configService.get('themes')) || [];
    const theme = themes?.find((t) => t.id === id);
    if (!theme) {
      throw new InternalServerErrorException(`主题配置不存在`);
    }
    const config = JSON.parse(theme.config || '[]') as ThemeConfigItemAll[];
    let c = config.find((c) => c.key === key);
    if (!c) {
      c = config.find((c) => c.name === key);
      if (!c) throw new InternalServerErrorException(`主题配置名不存在`);
    }
    c.value = value;
    theme.config = JSON.stringify(config);
    await this.configService.patchAndValidate('themes', [
      ...themes.filter((t) => t.id !== id),
      theme,
    ]);
    return true;
  }
}