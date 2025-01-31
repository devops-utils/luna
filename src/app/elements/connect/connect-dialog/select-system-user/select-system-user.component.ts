import {ChangeDetectorRef, Component, EventEmitter, Inject, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {SystemUser, SystemUserGroup, TreeNode, View} from '@app/model';
import {BehaviorSubject, ReplaySubject, Subject} from 'rxjs';
import {FormControl, Validators} from '@angular/forms';
import {groupByProp} from '@app/utils/common';
import {AppService, LocalStorageService, LogService, SettingService, I18nService} from '@app/services';
import {takeUntil} from 'rxjs/operators';

@Component({
  selector: 'elements-select-system-user',
  templateUrl: 'select-system-user.component.html',
  styleUrls: ['./select-system-user.component.scss'],
})
export class ElementSelectSystemUserComponent implements OnInit, OnDestroy {
  @Input() node: TreeNode;
  @Input() systemUsers: SystemUser[];
  @Input() onSubmit: BehaviorSubject<boolean>;
  @Output() onSelectSystemUser: EventEmitter<SystemUser> = new EventEmitter<SystemUser>();

  protected _onDestroy = new Subject<void>();
  public systemUserSelected: SystemUser;
  public systemUsersGroups: SystemUserGroup[];
  public filteredUsersGroups: ReplaySubject<SystemUserGroup[]> = new ReplaySubject<SystemUserGroup[]>(1);
  public sysUserCtrl: FormControl = new FormControl();
  public filteredCtrl: FormControl = new FormControl();
  public compareFn = (f1, f2) => f1 && f2 && f1.id === f2.id;

  constructor(private _settingSvc: SettingService,
              private _cdRef: ChangeDetectorRef,
              private _logger: LogService,
              private _appSvc: AppService,
              private _localStorage: LocalStorageService,
              private _i18n: I18nService,
  ) {}

  ngOnInit() {
    this.systemUserSelected = this.systemUsers[0];
    this.systemUsersGroups = this.groupSystemUsers();
    this.filteredUsersGroups.next(this.systemUsersGroups.slice());

    this.filteredCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterSysUsers();
      });

    this.sysUserCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.onSelectSystemUser.emit(this.systemUserSelected);
      });

    setTimeout(() => {
      this.sysUserCtrl.setValue(this.systemUserSelected);
      this.sysUserCtrl.setValidators([Validators.required]);
    }, 100);
  }

  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  getPreferSystemUser() {
    const nodeID = this._appSvc.getNodeTypeID(this.node);
    const preferId = this._appSvc.getNodePreferSystemUser(nodeID);
    const matchedSystemUsers = this.systemUsers.find((item) => item.id === preferId);
    if (preferId && matchedSystemUsers) return matchedSystemUsers;
    return null;
  }

  groupSystemUsers() {
    const groups = [];
    const preferSystemUser:any = this.getPreferSystemUser();
    if(preferSystemUser) {
      this.systemUserSelected = preferSystemUser;
      groups.push({
        name: this._i18n.instant('Last login'),
        systemUsers: [preferSystemUser]
      });
    }
    const protocolSysUsersMapper = groupByProp(this.systemUsers, 'protocol');
    for (const [protocol, users] of Object.entries(protocolSysUsersMapper)) {
      groups.push({
        name: protocol.toUpperCase(),
        systemUsers: users
      });
    }
    this._logger.debug('Grouped system user: ', groups);
    return groups;
  }

  filterSysUsers() {
    if (!this.systemUsersGroups) {
      return;
    }
    let search = this.filteredCtrl.value;
    const systemUsersGroupsCopy = this.copyGroupedSystemUsers(this.systemUsersGroups);

    if (!search) {
      this.filteredUsersGroups.next(this.systemUsersGroups.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    this.filteredUsersGroups.next(
      systemUsersGroupsCopy.filter(group => {
        const showGroup = group.name.toLowerCase().indexOf(search) > -1;
        if (!showGroup) {
          group.systemUsers = group.systemUsers.filter(
            sysUser => {
              return sysUser.name.toLowerCase().indexOf(search) > -1;
            }
          );
        }
        return group.systemUsers.length > 0;
      })
    );
  }

  protected copyGroupedSystemUsers(groups) {
    const systemUsersCopy = [];
    groups.forEach(group => {
      systemUsersCopy.push({
        name: group.name,
        systemUsers: group.systemUsers.slice()
      });
    });
    return systemUsersCopy;
  }
}
