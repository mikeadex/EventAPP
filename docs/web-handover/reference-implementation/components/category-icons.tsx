import {
  MusicNotes,
  Microphone,
  BookOpen,
  HandHeart,
  Coins,
  Lightning,
  HandsPraying,
  Guitar,
} from "@phosphor-icons/react/ssr";
import type { Category } from "@/lib/data";

export const categoryIcons: Record<Category, typeof MusicNotes> = {
  Worship: MusicNotes,
  Conference: Microphone,
  Class: BookOpen,
  Outreach: HandHeart,
  Fundraiser: Coins,
  Youth: Lightning,
  Prayer: HandsPraying,
  Concert: Guitar,
};

