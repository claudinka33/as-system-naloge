// Register ikon (lucide) za konfiguracijo delovnih mest / kategorij iz baze.
// V bazi hranimo IME ikone (string); tukaj ga preslikamo v komponento.
import {
  Building, Building2, ShoppingCart, TrendingUp, Cog, Phone, ShieldCheck,
  Package, Boxes, Box, FileText, Wallet, Users, User, Wrench, Hammer,
  Factory, Briefcase, Truck, ClipboardList, Clipboard, Ruler, Scale, Award,
  AlertCircle, CheckCircle2, Star, Tag, Tags, Layers, Archive, PenTool,
  Settings, Warehouse, Mail, Calendar, Clock, DollarSign, Percent, Gauge,
  Beaker, Recycle, Zap, Globe, MapPin, Bell, Folder, Search, BarChart3,
} from 'lucide-react';

// Urejen seznam za izbirnik ikon v UI
export const ICON_LIST = [
  ['Building', Building], ['Building2', Building2], ['Warehouse', Warehouse],
  ['ShoppingCart', ShoppingCart], ['TrendingUp', TrendingUp], ['DollarSign', DollarSign],
  ['Percent', Percent], ['Wallet', Wallet], ['Briefcase', Briefcase],
  ['Cog', Cog], ['Settings', Settings], ['Wrench', Wrench], ['Hammer', Hammer],
  ['Factory', Factory], ['Package', Package], ['Boxes', Boxes], ['Box', Box],
  ['Truck', Truck], ['Archive', Archive], ['Layers', Layers], ['Folder', Folder],
  ['ShieldCheck', ShieldCheck], ['Award', Award], ['Star', Star], ['Gauge', Gauge],
  ['Ruler', Ruler], ['Scale', Scale], ['Beaker', Beaker], ['Recycle', Recycle],
  ['PenTool', PenTool], ['ClipboardList', ClipboardList], ['Clipboard', Clipboard],
  ['FileText', FileText], ['Tag', Tag], ['Tags', Tags], ['BarChart3', BarChart3],
  ['Users', Users], ['User', User], ['Phone', Phone], ['Mail', Mail],
  ['Calendar', Calendar], ['Clock', Clock], ['Bell', Bell], ['MapPin', MapPin],
  ['Globe', Globe], ['Zap', Zap], ['Search', Search], ['AlertCircle', AlertCircle],
  ['CheckCircle2', CheckCircle2],
];

const ICON_MAP = Object.fromEntries(ICON_LIST);

// Vrne komponento ikone po imenu (fallback: Building2)
export function getIcon(name) {
  return ICON_MAP[name] || Building2;
}

export const ICON_NAMES = ICON_LIST.map(([n]) => n);
