import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Copy, Star, Eye, FolderInput, MoreHorizontal, Trash2, Check } from 'lucide-react';
import { ButtonGroup } from '../../components/ui/button-group';
import type { Clip, Category } from './model';
type Props = {
  clip: Clip;
  categories: Category[];
  theme: string;
  busy: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onPin: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onMove: (category: string) => void;
  onManage: () => void;
};
export function ItemMenu(props: Props) {
  return (
    <ButtonGroup
      aria-label="Item actions"
      className="row-button-group"
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) props.onOpen();
        }}
      >
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          onPointerDownCapture={(event) => event.currentTarget.focus()}
          className="row-menu-trigger"
          aria-label={`More actions: ${props.clip.title}`}
          disabled={props.busy}
        >
          <MoreHorizontal size={21} />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={props.onCopy}>
            <Copy size={17} />
            Copy text
          </DropdownMenuItem>
          <DropdownMenuItem onClick={props.onPin}>
            <Star size={17} />
            {props.clip.pinned ? 'Unpin item' : 'Pin item'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={props.onPreview}>
            <Eye size={17} />
            View full text
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput size={17} />
              Move to collection
            </DropdownMenuSubTrigger>

            <DropdownMenuSubContent className="min-w-48">
              <DropdownMenuItem onClick={() => props.onMove('')}>
                No collection
                {!props.clip.category && <Check size={15} className="menu-end" />}
              </DropdownMenuItem>
              {props.categories.map((category) => (
                <DropdownMenuItem key={category.id} onClick={() => props.onMove(category.id)}>
                  {category.name}
                  {props.clip.category === category.id && <Check size={15} className="menu-end" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="menu-separator" />
              <DropdownMenuItem onClick={props.onManage}>Manage collections…</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator className="menu-separator" />
          <DropdownMenuItem variant="destructive" onClick={props.onDelete}>
            <Trash2 size={17} />
            Delete item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
