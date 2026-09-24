import { FireSphere } from '@/components/ui/fire-sphere';

export default function DemoOne() {
  return (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-black/40 rounded-3xl p-6">
      <FireSphere
        bloomStrength={1.6}
        bloomRadius={0.75}
        bloomThreshold={0.08}
        color0={[255, 79, 139]}
        color1={[198, 108, 255]}
        animate
        className="w-48 h-48"
      />
    </div>
  );
}
