import { GenomeHub } from 'wuepgg';

interface BrowserWorkspaceProps {
  genomeName: string;
  viewRegion: string;
  tracks: Array<Record<string, unknown>>;
  showGenomeNavigator: boolean;
  showNavBar: boolean;
  showToolBar: boolean;
  darkMode: boolean;
}

function BrowserWorkspace({
  genomeName,
  viewRegion,
  tracks,
  showGenomeNavigator,
  showNavBar,
  showToolBar,
  darkMode,
}: BrowserWorkspaceProps) {
  return (
    <GenomeHub
      storeConfig={{ storeId: 'smaht-browser', enablePersistence: false }}
      genomeName={genomeName}
      viewRegion={viewRegion}
      tracks={tracks}
      showGenomeNavigator={showGenomeNavigator}
      showNavBar={showNavBar}
      showToolBar={showToolBar}
      darkMode={darkMode}
      height={860}
    />
  );
}

export default BrowserWorkspace;
