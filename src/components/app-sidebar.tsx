import {
  Clipboard,
  History,
  Star,
  Link,
  FileText,
  Code2,
  Folder,
  Plus,
  Settings,
} from 'lucide-react';
import type { Clip, Category, Filter } from '@/features/history/model';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from '@/components/ui/sidebar';
type Props = {
  clips: Clip[];
  categories: Category[];
  filter: Filter;
  category: string;
  onFilter: (filter: Filter, category?: string) => void;
  onCategories: () => void;
  onSettings: () => void;
};
export function AppSidebar({
  clips,
  categories,
  filter,
  category,
  onFilter,
  onCategories,
  onSettings,
}: Props) {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = (next: Filter, collection?: string) => {
    onFilter(next, collection);
    if (isMobile) setOpenMobile(false);
  };
  const views = [
    { id: 'all' as const, name: 'All clips', icon: History, count: clips.length },
    {
      id: 'pinned' as const,
      name: 'Pinned',
      icon: Star,
      count: clips.filter((clip) => clip.pinned).length,
    },
    {
      id: 'link' as const,
      name: 'Links',
      icon: Link,
      count: clips.filter((clip) => clip.kind === 'link').length,
    },
    {
      id: 'text' as const,
      name: 'Text',
      icon: FileText,
      count: clips.filter((clip) => clip.kind === 'text').length,
    },
    {
      id: 'code' as const,
      name: 'Code',
      icon: Code2,
      count: clips.filter((clip) => clip.kind === 'code').length,
    },
  ];
  return (
    <Sidebar collapsible="offcanvas" className="tuck-sidebar">
      <SidebarHeader className="tuck-sidebar-header">
        <div className="tuck-brand">
          <Clipboard className="text-violet-400" size={21} />
          <span>
            Tuck<span className="brand-dot">.</span>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {views.map(({ id, name, icon: Icon, count }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  className={`nav-${id}`}
                  isActive={!category && filter === id}
                  onClick={() => navigate(id)}
                >
                  <Icon />
                  <span>{name}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{count}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Collections</SidebarGroupLabel>
          <SidebarGroupAction aria-label="Manage collections" onClick={onCategories}>
            <Plus />
          </SidebarGroupAction>
          <SidebarMenu>
            {categories.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={category === item.id}
                  onClick={() => navigate('all', item.id)}
                >
                  <Folder />
                  <span>{item.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {!categories.length && (
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onCategories}>
                  <Plus />
                  <span>Create collection</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="tuck-sidebar-footer">
        <p className="sidebar-tagline">Copy it. Tuck it. Find it.</p>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSettings}>
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
